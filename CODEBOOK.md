# Codebook: Hong Kong street-name rendering

## Scope

The unit is an official bilingual street or road name recorded by the Hong
Kong Transport Department. The analytic direction is Traditional Chinese to
English, but an official pair does not prove which form came first. The
categories therefore describe the observable relationship between the two
official names, not a verified historical origin.

The four categories follow the broad distinction in Vinay and Darbelnet (1958)
between borrowing and calque, with supporting ideas from Newmark's (1988)
account of transference and literal translation. Classification also uses the
Cantonese Jyutping pronunciation of the Chinese name and a fixed glossary of
common English semantic equivalents.

## 1. Phonetic transliteration

**Definition.** The English name represents the sound of the Cantonese name,
usually syllable by syllable, rather than translating its individual meaning.

**Decision rule.** The cleaned English name has a character similarity of at
least 0.50 with the Jyutping of the Chinese name, and no semantic glossary item
is matched.

**Example.** 汀逸路 -> TING YAT ROAD (1.000).

**Contrast.** An entry is not phonetic merely because it has a traditional
English-looking spelling; the printed English must measurably resemble the
Cantonese pronunciation.

## 2. Semantic translation

**Definition.** At least one English content word translates a meaning present
in the Chinese name, while the whole pair does not show a strong phonetic
match.

**Decision rule.** A fixed English-to-Chinese gloss is present in the Chinese
text and the full-name phonetic score is below 0.50.

**Example.** 油街 -> OIL STREET (`OIL` -> 油).

**Contrast.** OIL STREET is not treated as phonetic because its English
letters do not approximate 油街's Cantonese pronunciation.

## 3. Hybrid phonetic-semantic rendering

**Definition.** One part of the name is represented by sound and another part
is translated by meaning.

**Decision rule.** The full name has a phonetic score of at least 0.50 and at
least one semantic glossary item also matches.

**Example.** 天后廟道 -> TIN HAU TEMPLE ROAD. `TIN HAU` tracks the Cantonese
pronunciation, while `TEMPLE` translates 廟.

**Boundary case.** 油街 -> OIL STREET is semantic, not hybrid: sound similarity
is absent even though the generic Chinese character 街 corresponds to STREET.

## 4. Conventional or indirect rendering

**Definition.** The pair has neither a rule-based Cantonese phonetic match nor
a match in the semantic glossary. Such names may involve historical renaming,
an established English proper-name convention, abbreviation, or an indirect
official choice.

**Decision rule.** Assign this category provisionally when both automated
criteria fail. These rows require human review before use as strong evidence.

**Example.** 碧翠路 -> RAZOR HILL ROAD. Neither `RAZOR`, `HILL`, nor the full
English form transparently matches the printed Chinese pair.

**Contrast.** 南丁格爾路 -> NIGHTINGALE ROAD is also conventional under the
rule-based score because it is a phonetic treatment of an English proper name;
the category name records the weak match, not a claim that the name lacks a
historical explanation.

## Coding log

- 2026-11-11: Initial four-category rule set established before inspecting the
  500-row sample.
- 2026-11-11: The phonetic threshold was lowered from 0.52 to 0.50 after 30
  examples showed several transparent Cantonese renderings landing exactly at
  0.50.
- 2026-11-11: Common semantic glosses for colors, directions, buildings, and
  landscape terms were added before the final sample was written.

## Current quality status

All 500 rows were machine-checked against the reduced official-name cache.
Personal source checking is still pending. `human_checked=yes` must only be
entered after a person compares the row with the official DATA.GOV.HK source.
