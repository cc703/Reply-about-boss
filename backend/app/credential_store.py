"""Windows Credential Manager storage for the local DeepSeek API key."""

from __future__ import annotations

import ctypes
import os
from ctypes import wintypes
from typing import Any, Optional


CRED_TYPE_GENERIC = 1
CRED_PERSIST_LOCAL_MACHINE = 2
ERROR_NOT_FOUND = 1168
CREDENTIAL_TARGET = "BOSS Chat Listener/DeepSeek API Key"


class CredentialStoreError(RuntimeError):
    """Raised when the operating-system credential store cannot be used."""


def normalize_api_key(value: str) -> str:
    normalized = str(value or "").strip()
    if not normalized:
        raise ValueError("DeepSeek API key cannot be blank")
    if len(normalized) > 256:
        raise ValueError("DeepSeek API key is too long")
    return normalized


class _Credential(ctypes.Structure):
    _fields_ = [
        ("Flags", wintypes.DWORD),
        ("Type", wintypes.DWORD),
        ("TargetName", wintypes.LPWSTR),
        ("Comment", wintypes.LPWSTR),
        ("LastWritten", wintypes.FILETIME),
        ("CredentialBlobSize", wintypes.DWORD),
        ("CredentialBlob", ctypes.c_void_p),
        ("Persist", wintypes.DWORD),
        ("AttributeCount", wintypes.DWORD),
        ("Attributes", ctypes.c_void_p),
        ("TargetAlias", wintypes.LPWSTR),
        ("UserName", wintypes.LPWSTR),
    ]


class _WindowsCredentialAdapter:
    def __init__(self, target: str = CREDENTIAL_TARGET) -> None:
        if os.name != "nt":
            raise CredentialStoreError("Windows Credential Manager is unavailable")

        self.target = target
        self._advapi32 = ctypes.WinDLL("advapi32.dll", use_last_error=True)
        self._cred_write = self._advapi32.CredWriteW
        self._cred_write.argtypes = [ctypes.POINTER(_Credential), wintypes.DWORD]
        self._cred_write.restype = wintypes.BOOL

        self._cred_read = self._advapi32.CredReadW
        self._cred_read.argtypes = [
            wintypes.LPCWSTR,
            wintypes.DWORD,
            wintypes.DWORD,
            ctypes.POINTER(ctypes.POINTER(_Credential)),
        ]
        self._cred_read.restype = wintypes.BOOL

        self._cred_delete = self._advapi32.CredDeleteW
        self._cred_delete.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD]
        self._cred_delete.restype = wintypes.BOOL

        self._cred_free = self._advapi32.CredFree
        self._cred_free.argtypes = [ctypes.c_void_p]
        self._cred_free.restype = None

    @staticmethod
    def _last_error(action: str) -> CredentialStoreError:
        error_code = ctypes.get_last_error()
        return CredentialStoreError("Credential Manager operation failed: %s (%s)" % (action, error_code))

    def get(self) -> str:
        credential_pointer = ctypes.POINTER(_Credential)()
        success = self._cred_read(
            self.target,
            CRED_TYPE_GENERIC,
            0,
            ctypes.byref(credential_pointer),
        )
        if not success:
            if ctypes.get_last_error() == ERROR_NOT_FOUND:
                return ""
            raise self._last_error("read")

        try:
            credential = credential_pointer.contents
            if not credential.CredentialBlob or not credential.CredentialBlobSize:
                return ""
            value = ctypes.string_at(credential.CredentialBlob, credential.CredentialBlobSize)
            return value.decode("utf-8")
        except (UnicodeDecodeError, ValueError) as error:
            raise CredentialStoreError("Stored credential is invalid") from error
        finally:
            self._cred_free(credential_pointer)

    def set(self, value: str) -> None:
        encoded = value.encode("utf-8")
        buffer = ctypes.create_string_buffer(encoded)
        credential = _Credential()
        credential.Type = CRED_TYPE_GENERIC
        credential.TargetName = self.target
        credential.CredentialBlobSize = len(encoded)
        credential.CredentialBlob = ctypes.cast(buffer, ctypes.c_void_p)
        credential.Persist = CRED_PERSIST_LOCAL_MACHINE
        credential.UserName = "local-user"

        try:
            if not self._cred_write(ctypes.byref(credential), 0):
                raise self._last_error("write")
        finally:
            ctypes.memset(ctypes.addressof(buffer), 0, len(encoded))

    def clear(self) -> None:
        success = self._cred_delete(self.target, CRED_TYPE_GENERIC, 0)
        if not success and ctypes.get_last_error() != ERROR_NOT_FOUND:
            raise self._last_error("delete")


class CredentialStore:
    """Small injectable facade used by the backend and its tests."""

    def __init__(self, adapter: Optional[Any] = None) -> None:
        self._adapter = adapter

    def _get_adapter(self) -> Any:
        if self._adapter is None:
            self._adapter = _WindowsCredentialAdapter()
        return self._adapter

    def get(self) -> str:
        return self._get_adapter().get()

    def set(self, value: str) -> None:
        self._get_adapter().set(normalize_api_key(value))

    def clear(self) -> None:
        self._get_adapter().clear()
