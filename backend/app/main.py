"""Local FastAPI service for BOSS reply draft suggestions."""

from __future__ import annotations

from typing import Dict, List, Literal, Optional, Union

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .credential_store import CredentialStore, CredentialStoreError, normalize_api_key
from .deepseek_client import DeepSeekClient, DeepSeekRequestError, MissingApiKeyError
from .draft_guard import build_safe_fallback, filter_grounded_drafts
from .prompt_builder import build_chat_messages


class TranscriptRecord(BaseModel):
    role: Literal["hr", "self", "system", "control", "unknown"]
    text: str = Field(default="", max_length=1200)


class ReplyDraftRequest(BaseModel):
    records: List[TranscriptRecord] = Field(default_factory=list, max_length=30)
    tone: str = Field(default="natural", max_length=40)
    custom_tone: str = Field(default="", max_length=80)
    reply_intent: Literal["auto", "continue", "decline", "close"] = "auto"


class ReplyDraft(BaseModel):
    tone: str
    text: str


class ReplyDraftResponse(BaseModel):
    drafts: List[ReplyDraft]
    model: str


class ErrorResponse(BaseModel):
    error: str
    message: str


class KeyStatusResponse(BaseModel):
    configured: bool


app = FastAPI(title="BOSS Chat Listener Backend", version="0.12.0")
credential_store = CredentialStore()

RETRY_INSTRUCTION = {
    "role": "user",
    "content": (
        "上一轮输出为空或包含聊天记录中没有出现的事实。请用真实求职者聊天的自然短句重新生成，并严格避免解释未回复原因、"
        "断言没有顾虑或没有问题、虚构技术能力或项目经验、确认聊天或面试时间；只回应最新 HR "
        "消息，未知信息使用中性表达，需要用户确认的内容不要代替用户作出承诺。不要写成正式邮件或客服话术。"
    ),
}

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://www.zhipin.com",
        "http://localhost:8765",
        "http://127.0.0.1:8765",
    ],
    allow_origin_regex=r"^https://.*\.zhipin\.com$|^chrome-extension://.*$",
    allow_credentials=False,
    allow_methods=["DELETE", "GET", "POST", "OPTIONS", "PUT"],
    allow_headers=["Content-Type", "X-DeepSeek-API-Key"],
)


@app.get("/")
def root() -> Dict[str, object]:
    return health()


@app.get("/health")
def health() -> Dict[str, object]:
    return {
        "ok": True,
        "service": "boss-chat-listener-backend",
    }


@app.get("/api/settings/deepseek-key/status", response_model=KeyStatusResponse)
def get_deepseek_key_status() -> KeyStatusResponse:
    try:
        return KeyStatusResponse(configured=bool(credential_store.get()))
    except CredentialStoreError as error:
        raise HTTPException(status_code=503, detail="本地凭据存储不可用。") from error


@app.put("/api/settings/deepseek-key", response_model=KeyStatusResponse)
def save_deepseek_key(
    api_key: Optional[str] = Header(default=None, alias="X-DeepSeek-API-Key"),
) -> KeyStatusResponse:
    if api_key is None:
        raise HTTPException(status_code=400, detail="API Key 不能为空。")

    try:
        credential_store.set(normalize_api_key(api_key))
    except ValueError as error:
        raise HTTPException(status_code=400, detail="API Key 不能为空或长度无效。") from error
    except CredentialStoreError as error:
        raise HTTPException(status_code=503, detail="本地凭据存储不可用。") from error

    return KeyStatusResponse(configured=True)


@app.delete("/api/settings/deepseek-key", response_model=KeyStatusResponse)
def clear_deepseek_key() -> KeyStatusResponse:
    try:
        credential_store.clear()
    except CredentialStoreError as error:
        raise HTTPException(status_code=503, detail="本地凭据存储不可用。") from error
    return KeyStatusResponse(configured=False)


@app.post(
    "/api/reply-drafts",
    response_model=Union[ReplyDraftResponse, ErrorResponse],
)
def create_reply_drafts(request: ReplyDraftRequest) -> Union[ReplyDraftResponse, ErrorResponse]:
    records = [record.model_dump() for record in request.records]

    try:
        messages = build_chat_messages(
            records,
            tone=request.tone,
            custom_tone=request.custom_tone,
            reply_intent=request.reply_intent,
        )
    except ValueError:
        return ErrorResponse(
            error="empty_context",
            message="当前会话不足，先等待 HR 消息或重新识别。",
        )

    try:
        api_key = credential_store.get()
        client = DeepSeekClient(api_key=api_key)
        safe_drafts: List[Dict[str, str]] = []
        model = "deepseek-v4-flash"

        for attempt in range(2):
            response = client.create_reply_drafts(messages)
            model = str(response.get("model") or model)
            safe_drafts = filter_grounded_drafts(
                response.get("drafts", []),
                records,
                reply_intent=request.reply_intent,
            )
            if safe_drafts:
                break
            if attempt == 0:
                messages = [*messages, RETRY_INSTRUCTION]
    except CredentialStoreError:
        return ErrorResponse(
            error="credential_store_error",
            message="本地凭据存储不可用，请重启后端后重试。",
        )
    except MissingApiKeyError:
        return ErrorResponse(
            error="missing_api_key",
            message="请先在扩展弹窗中保存 DeepSeek API Key。",
        )
    except DeepSeekRequestError:
        return ErrorResponse(
            error="model_error",
            message="DeepSeek 暂时不可用，请稍后重试。",
        )

    if not safe_drafts:
        safe_drafts = build_safe_fallback(records, reply_intent=request.reply_intent)
        model = "local-safe-fallback"

    if not safe_drafts:
        return ErrorResponse(error="unsafe_or_empty_drafts", message="未生成可靠草稿，请稍后重试。")

    return ReplyDraftResponse(
        drafts=[ReplyDraft(**draft) for draft in safe_drafts],
        model=model,
    )
