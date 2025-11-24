import argparse
import json
import re
from pathlib import Path

from deep_translator import GoogleTranslator


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = REPO_ROOT / "auction-admin" / "locales" / "en.default.json"
DEFAULT_OUTPUT = REPO_ROOT / "auction-admin" / "locales"
BUNDLED_LANGS = {
    "pl": "pl",
    "de": "de",
    "fr": "fr",
    "it": "it",
    "nl": "nl",
    "ar": "ar",
    "ja": "ja",
    "ko": "ko",
}

PLACEHOLDER_PATTERN = re.compile(r"(\{\{.*?\}\}|\{[^\{\}]+\})")


def protect_placeholders(text: str):
    tokens = []

    def _replace(match):
        tokens.append(match.group(0))
        return f"__TOKEN_{len(tokens) - 1}__"

    safe_text = PLACEHOLDER_PATTERN.sub(_replace, text)
    return safe_text, tokens


def restore_placeholders(text: str, tokens):
    for idx, token in enumerate(tokens):
        text = text.replace(f"__TOKEN_{idx}__", token)
    return text


def translate_value(value, translator, cache):
    if isinstance(value, dict):
        return {k: translate_value(v, translator, cache) for k, v in value.items()}
    if isinstance(value, list):
        return [translate_value(v, translator, cache) for v in value]
    if isinstance(value, str):
        key = (value, translator.target)
        if key in cache:
            return cache[key]

        safe_text, tokens = protect_placeholders(value)
        try:
            translated = translator.translate(safe_text)
        except Exception as exc:
            print(f"[warn] Failed to translate '{value}' to {translator.target}: {exc}. Keeping original.")
            translated = safe_text
        translated = restore_placeholders(translated, tokens)
        cache[key] = translated
        return translated

    return value


def parse_args():
    parser = argparse.ArgumentParser(description="Translate locale JSON files from a source language.")
    parser.add_argument(
        "--source",
        type=Path,
        default=DEFAULT_SOURCE,
        help=f"Path to the source JSON (default: {DEFAULT_SOURCE})",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Directory to write translated files (default: {DEFAULT_OUTPUT})",
    )
    parser.add_argument(
        "--langs",
        nargs="+",
        help="Locale codes to translate (default: all configured languages).",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    if args.langs:
        missing = [code for code in args.langs if code not in BUNDLED_LANGS]
        if missing:
            raise ValueError(f"Unsupported locale codes: {', '.join(missing)}")
        target_langs = {code: BUNDLED_LANGS[code] for code in args.langs}
    else:
        target_langs = BUNDLED_LANGS

    with args.source.open(encoding="utf-8") as f:
        source_data = json.load(f)

    args.output_dir.mkdir(parents=True, exist_ok=True)

    for locale, lang_code in target_langs.items():
        print(f"Translating locale '{locale}'...")
        cache = {}
        translator = GoogleTranslator(source="en", target=lang_code)
        translated = translate_value(source_data, translator, cache)

        target_path = args.output_dir / f"{locale}.json"
        with target_path.open("w", encoding="utf-8") as f:
            json.dump(translated, f, ensure_ascii=False, indent=2)

    print("Translation complete.")


if __name__ == "__main__":
    main()
