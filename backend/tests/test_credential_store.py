import unittest

try:
    from backend.app.credential_store import CredentialStore, normalize_api_key
except ImportError:
    CredentialStore = None
    normalize_api_key = None


class MemoryAdapter:
    def __init__(self):
        self.value = ""

    def get(self):
        return self.value

    def set(self, value):
        self.value = value

    def clear(self):
        self.value = ""


class CredentialStoreTest(unittest.TestCase):
    def test_store_uses_adapter_and_supports_persistence_operations(self):
        self.assertIsNotNone(CredentialStore)
        store = CredentialStore(adapter=MemoryAdapter())

        self.assertEqual(store.get(), "")
        store.set("test-key")
        self.assertEqual(store.get(), "test-key")
        store.clear()
        self.assertEqual(store.get(), "")

    def test_normalize_api_key_rejects_blank_values(self):
        self.assertIsNotNone(normalize_api_key)
        if normalize_api_key is None:
            return

        with self.assertRaises(ValueError):
            normalize_api_key("   ")

    def test_normalize_api_key_trims_without_exposing_value(self):
        self.assertIsNotNone(normalize_api_key)
        if normalize_api_key is None:
            return

        self.assertEqual(normalize_api_key("  test-key  "), "test-key")


if __name__ == "__main__":
    unittest.main()
