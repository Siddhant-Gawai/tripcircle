# Changelog

Dated TripCircle patches, newest first. See the [README](README.md) for features, setup and project architecture.

## 27 October 2026

Save and remove buttons on destination cards now include the place name in their accessible labels, so screen-reader users can identify the destination without relying on nearby text. Desktop and mobile search checks use the destination-specific save labels.

## 23 October 2026

Place-search results now show how many matching places were found, with singular/plural labels. The cards sit in a labelled results section that screen-reader users can navigate to directly.

## 22 October 2026

The place-search question field now shows a live character counter against its existing 600-character limit. The counter is linked to the field as an accessible description, alongside the keyboard-shortcut hint.

## 16 October 2026

Holding Ctrl+Enter or ⌘+Enter no longer repeats place-search submissions. Repeated keydown events are ignored while a fresh key press still submits normally. Desktop and mobile regression checks cover held-key protection and normal shortcut submission.

## 15 October 2026

Place-search keyboard shortcuts now ignore Enter while an input method is composing text. This prevents Ctrl+Enter or ⌘+Enter from submitting an unfinished question. Desktop and mobile regression checks cover composition followed by normal shortcut submission.

## 14 October 2026

Place search now supports **Ctrl+Enter** and **⌘+Enter** to submit a question. Enter alone still adds a new line. The shortcut uses normal form validation and does not submit another request while a search is running. Desktop and mobile regression checks cover both shortcuts and multiline input.

## 13 October 2026

If an AI search fails while you are drafting the next question, that new draft is now preserved. The failed question is restored only when the input is empty. Desktop and mobile regression checks cover a delayed failure while typing.

## 12 October 2026

Clearing a place-search conversation now returns keyboard focus to the question field, so you can immediately type a new search. Desktop and mobile regression checks verify the focus transition.

## 11 October 2026

Place search now includes **Clear conversation** to start fresh without reloading. It clears chat history, result cards, the draft question and search errors while keeping saved places and the selected search mode. The button is disabled during active searches or save operations. Desktop and mobile regression checks verify clearing and starting a new search.

## 9 October 2026

Starting a new place search now clears the previous result cards. If AI search fails, the question returns to the input for retry and the failed turn is removed from chat history. This prevents old recommendations from appearing to answer a failed search and avoids duplicate questions when retrying. Desktop and mobile regression checks cover failure and recovery.

## 7 October 2026

Catalogue search now matches landscape keywords as whole words. Searching “research Jawhar” returns Jawhar instead of accidentally matching “sea” inside “research” and showing beaches. Plural searches such as “beaches”, “hills” and “waterfalls” continue to work. Desktop and mobile regression checks cover destination-name searches and plural categories.

A second small patch includes every landscape requested in a catalogue search: “beaches or hills” now returns both coastal and hill destinations instead of only the first category. Desktop and mobile regression checks cover this combined search.

## 5 October 2026

A successful retry now clears the previous trip-decisions error after reloading the polls and overview. If a retry fails, the latest error remains visible. To check manually, interrupt the connection while loading trip decisions, restore it, then choose **Retry** and confirm the error disappears when the data loads.
