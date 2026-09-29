"""Synthetic collector checks; fixtures never enter the submission's session logs."""

import json
import io
from pathlib import Path
import tempfile
import unittest

from agent_capture import capture, importable_messages, read_hook_input


class CaptureTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.config = {"author": "test", "project": "test"}
        self.event = {"session_id": "test-session", "turn_id": "turn-1", "cwd": str(self.root), "model": "test-model"}

    def tearDown(self):
        self.temp.cleanup()

    def send(self, name, **fields):
        return capture({**self.event, "hook_event_name": name, **fields}, self.root, self.config)

    def test_exact_body_model_switch_and_repeated_hooks(self):
        prompt = "  literal prompt\n\nUnicode — नमस्ते\n" + "x" * 30000
        path = self.send("UserPromptSubmit", prompt=prompt)
        old = path.read_bytes()
        self.assertIsNone(self.send("UserPromptSubmit", prompt=prompt))
        self.assertEqual(old, path.read_bytes())
        response = "final\n\n```text\nkeep whitespace  \n```\n"
        self.send("Stop", last_assistant_message=response, model="other-model")
        text = path.read_text(encoding="utf-8")
        self.assertIn(prompt, text)
        self.assertIn(response, text)
        self.assertIn("model: other-model", text)
        self.assertEqual(text.count("[LOG_ENTRY type=PROMPT"), 1)
        self.assertEqual(text.count("[LOG_ENTRY type=RESPONSE"), 1)

    def test_same_prompt_in_different_turns_is_retained(self):
        path = self.send("UserPromptSubmit", prompt="same")
        self.send("Stop", last_assistant_message="ok")
        self.send("UserPromptSubmit", prompt="same", turn_id="turn-2")
        text = path.read_text(encoding="utf-8")
        self.assertIn("total_exchanges: 2", text)
        self.assertEqual(text.count("[LOG_ENTRY type=PROMPT"), 2)

    def test_cannot_replace_an_entry_or_invent_a_prompt(self):
        with self.assertRaises(ValueError):
            self.send("Stop", last_assistant_message="unmatched")
        path = self.send("UserPromptSubmit", prompt="original")
        old = path.read_bytes()
        with self.assertRaises(ValueError):
            self.send("UserPromptSubmit", prompt="replacement")
        self.assertEqual(old, path.read_bytes())

    def test_project_scope_and_session_path_validation(self):
        self.assertIsNone(self.send("UserPromptSubmit", prompt="private", cwd=str(self.root.parent)))
        with self.assertRaises(ValueError):
            self.send("UserPromptSubmit", prompt="x", session_id="../escape")
        self.assertFalse((self.root / ".agent-logs").exists())

    def test_recovery_excludes_reasoning_tools_and_commentary(self):
        def record(kind, payload):
            return {"type": kind, "timestamp": "2026-09-29T00:00:00Z", "payload": payload}
        records = [record("turn_context", {"turn_id": "one", "model": "model-a"})]
        for role, phase, text in [("developer", None, "instructions"), ("assistant", "commentary", "progress"), ("user", None, "actual prompt"), ("assistant", "final", "actual final")]:
            records.append(record("response_item", {"type": "message", "role": role, "phase": phase, "content": [{"type": "input_text" if role == "user" else "output_text", "text": text}]}))
        records += [record("response_item", {"type": "reasoning", "summary": "hidden"}), record("response_item", {"type": "function_call", "arguments": "tool data"})]
        self.assertEqual([m["body"] for m in importable_messages(records)], ["actual prompt", "actual final"])

    def test_windows_newlines_and_external_edits(self):
        path = self.send("UserPromptSubmit", prompt="first\r\nsecond\r\n")
        self.send("Stop", last_assistant_message="final\r\n")
        self.assertIn(b"first\r\nsecond\r\n", path.read_bytes())
        corrupted = path.read_bytes().replace(b"first", b"changed")
        path.write_bytes(corrupted)
        with self.assertRaises(ValueError):
            self.send("UserPromptSubmit", prompt="next", turn_id="two")
        self.assertEqual(corrupted, path.read_bytes())

    def test_crash_after_journal_write_is_recoverable(self):
        path = self.send("UserPromptSubmit", prompt="real")
        expected = path.read_bytes()
        path.unlink()
        self.send("UserPromptSubmit", prompt="real")
        self.assertEqual(expected, path.read_bytes())

    def test_resume_pairs_model_switch_with_original_prompt(self):
        path = self.send("UserPromptSubmit", prompt="original")
        self.send("Stop", turn_id="resumed", model="next-model", last_assistant_message="finished")
        self.assertIn("[LOG_ENTRY type=RESPONSE num=1", path.read_text())

    def test_hook_stdin_is_utf8_independent_of_windows_codepage(self):
        raw = json.dumps({"prompt": "CAPTURE TEST — नमस्ते"}, ensure_ascii=False).encode("utf-8")
        self.assertEqual(read_hook_input(io.BytesIO(raw))["prompt"], "CAPTURE TEST — नमस्ते")


if __name__ == "__main__":
    unittest.main()
