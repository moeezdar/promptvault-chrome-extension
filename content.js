let lastFocusedElement = null;

// Remember the last input/textarea/contenteditable element
document.addEventListener("focusin", (event) => {
    const element = event.target;

    if (
        element.tagName === "TEXTAREA" ||
        element.tagName === "INPUT" ||
        element.isContentEditable
    ) {
        lastFocusedElement = element;
    }
}, true);


// Receive prompt from popup/background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    if (message.action !== "insertPrompt") {
        return;
    }

    const element =
        lastFocusedElement ||
        document.activeElement;

    if (!element) {
        sendResponse({ success: false });
        return;
    }

    const success = insertPrompt(element, message.text);

    sendResponse({
        success: success
    });
});


// Insert prompt into the selected element
function insertPrompt(element, text) {

    element.focus();

    // TEXTAREA or INPUT
    if (
        element.tagName === "TEXTAREA" ||
        element.tagName === "INPUT"
    ) {

        const start = element.selectionStart ?? element.value.length;
        const end = element.selectionEnd ?? element.value.length;

        const before = element.value.substring(0, start);
        const after = element.value.substring(end);

        element.value = before + text + after;

        const cursorPosition = start + text.length;

        element.setSelectionRange(
            cursorPosition,
            cursorPosition
        );

        // Notify frameworks such as React
        element.dispatchEvent(
            new InputEvent("input", {
                bubbles: true,
                inputType: "insertText",
                data: text
            })
        );

        return true;
    }


    // CONTENTEDITABLE elements
    if (element.isContentEditable) {

        const selection = window.getSelection();

        if (selection && selection.rangeCount > 0) {

            const range = selection.getRangeAt(0);

            range.deleteContents();

            const textNode = document.createTextNode(text);

            range.insertNode(textNode);

            range.setStartAfter(textNode);
            range.collapse(true);

            selection.removeAllRanges();
            selection.addRange(range);

        } else {

            element.appendChild(
                document.createTextNode(text)
            );

        }

        // Notify the website
        element.dispatchEvent(
            new InputEvent("input", {
                bubbles: true,
                inputType: "insertText",
                data: text
            })
        );

        return true;
    }


    return false;
}