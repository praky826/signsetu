import json
import os
import re

# Get the directory where this script is located
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DICT_PATH = os.path.join(SCRIPT_DIR, "isl_dictionary.json")

# Load ISL dictionary
with open(DICT_PATH, "r", encoding="utf-8") as f:
    ISL_DICT = json.load(f)

print(f"✅ Loaded {len(ISL_DICT)} ISL signs from dictionary")
print(f"   Sample words: {', '.join(list(ISL_DICT.keys())[:10])}")

# ============================================
# FINGER SPELLING MAP (ISL Alphabet)
# Each letter maps to a HamNoSys description
# of the handshape and orientation.
# ============================================
ISL_FINGER_SPELL = {
    "a": "hamfist hampalml",
    "b": "hamflathand hampalmf",
    "c": "hamcee hampalmr",
    "d": "hamindex hampalml",
    "e": "hamfist hampalmd",
    "f": "hampinch hampalmf",
    "g": "hamindex hampalmr",
    "h": "hamfinger2 hampalmd",
    "i": "hamthumbup hampalml",
    "j": "hamthumbup hampalml hammovedown",
    "k": "hamfinger2 hampalml",
    "l": "hamindex hampalml",
    "m": "hamfist hampalmd",
    "n": "hamfist hampalmd",
    "o": "hamcee hampalmf",
    "p": "hamindex hampalmd",
    "q": "hampinch hampalmd",
    "r": "hamfinger2 hampalmf",
    "s": "hamfist hampalmf",
    "t": "hamfist hampalml",
    "u": "hamfinger2 hampalmf",
    "v": "hamfinger2 hampalmf",
    "w": "hamflathand hampalmf",
    "x": "hamindex hampalmr",
    "y": "hamthumbup hampalmf",
    "z": "hamindex hampalmf hammovedown",
}


def clean_text(text):
    """
    Clean and normalize text for dictionary matching.
    Removes punctuation, extra spaces, and converts to lowercase.
    """
    text = re.sub(r'[^\w\s]', ' ', text)
    text = text.lower()
    text = ' '.join(text.split())
    return text


def text_to_hamnosys(text):
    """
    Convert English text to HamNoSys notation.
    
    Strategy:
      1. Try full phrase match first (e.g., "thank you")
      2. Try individual word match
      3. If word not found, finger-spell it letter by letter
    
    Args:
        text: English text (will be cleaned and lowercased)
    
    Returns:
        Comma-separated HamNoSys string
    """
    text = clean_text(text)
    
    # Try full phrase match first
    if text in ISL_DICT:
        result = ISL_DICT[text]["hamnosys"]
        print(f"  ✓ Full phrase match: '{text}' → {result}")
        return result
    
    # Split into words
    tokens = text.split()
    result = []
    unmatched = []

    for token in tokens:
        if token in ISL_DICT:
            # Word found in dictionary
            result.append(ISL_DICT[token]["hamnosys"])
            print(f"  ✓ Matched: '{token}' → {ISL_DICT[token]['hamnosys']}")
        else:
            # Word NOT found — finger spell it
            spell_result = finger_spell(token)
            if spell_result:
                result.extend(spell_result)
                print(f"  🔤 Finger-spelled: '{token}' → {len(spell_result)} letters")
            else:
                unmatched.append(token)
                print(f"  ✗ Not found and cannot spell: '{token}'")

    if unmatched:
        print(f"⚠ Unresolved words: {', '.join(unmatched)}")
    
    hamnosys_result = ",".join(result)
    print(f"📋 Final HamNoSys: {hamnosys_result if hamnosys_result else '(empty)'}")
    
    return hamnosys_result


def finger_spell(word):
    """
    Finger-spell a word letter by letter.
    
    Args:
        word: The word to finger-spell
    
    Returns:
        List of HamNoSys strings, one per letter
    """
    letters = list(word.lower())
    result = []
    
    for char in letters:
        if char in ISL_FINGER_SPELL:
            result.append(ISL_FINGER_SPELL[char])
        elif char in ISL_DICT:
            # Some letters might be in the main dictionary
            result.append(ISL_DICT[char]["hamnosys"])
        elif char.isalpha():
            # Unknown letter — use default flat hand
            result.append("hamflathand hampalmf")
            print(f"    ⚠ No finger-spell for '{char}', using default")
    
    return result if result else None


def get_available_words():
    """Return list of all available words in dictionary"""
    return sorted(ISL_DICT.keys())


def search_word(query):
    """Search for words containing the query string"""
    query = query.lower()
    matches = [word for word in ISL_DICT.keys() if query in word]
    return matches
