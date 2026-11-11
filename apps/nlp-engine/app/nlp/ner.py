import re


class NameNER:
    """
    spaCy-based Named Entity Recognition (with deterministic proper-noun fallback
    if spaCy/model is not installed in the active environment).
    """

    def __init__(self):
        self.nlp = None
        try:
            import spacy
            self.nlp = spacy.load("en_core_web_sm")
        except Exception:
            self.nlp = None

    def extract_persons(self, text: str):
        """
        Extract PERSON entities from text.
        """
        if not text:
            return []

        if self.nlp is not None:
            doc = self.nlp(text)
            persons = []
            for entity in doc.ents:
                if entity.label_ == "PERSON":
                    persons.append({
                        "name": entity.text,
                        "label": entity.label_,
                    })
            return persons

        # Fallback: capitalized 2-3 word proper-name candidates
        matches = re.findall(r"\b([A-Z][a-zA-Z]{1,20}(?:\s+[A-Z][a-zA-Z]{1,20}){1,2})\b", text)
        stop_words = {"Certificate", "Completion", "Excellence", "Training", "Artificial", "Intelligence", "Fundamentals", "Awarded"}
        persons = []
        for candidate in matches:
            words = set(candidate.split())
            if not (words & stop_words):
                persons.append({"name": candidate, "label": "PERSON"})
        return persons
