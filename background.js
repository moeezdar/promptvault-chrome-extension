// Serialize all menu rebuilds through a single promise chain so overlapping
// triggers (onInstalled + onStartup + storage.onChanged firing close together)
// can never race each other and corrupt the menu structure.
let menuUpdateChain = Promise.resolve();

function queueMenuRebuild() {
    menuUpdateChain = menuUpdateChain.then(rebuildMenus).catch((err) => {
        console.error("Menu rebuild failed:", err);
    });
    return menuUpdateChain;
}

function rebuildMenus() {
    return new Promise((resolve) => {
        chrome.contextMenus.removeAll(() => {
            chrome.contextMenus.create(
                {
                    id: "promptvault-parent",
                    title: "PromptVault",
                    contexts: ["editable"]
                },
                () => {
                    if (chrome.runtime.lastError) {
                        console.error("Parent creation error:", chrome.runtime.lastError.message);
                        resolve();
                        return;
                    }

                    chrome.storage.local.get("prompts", (result) => {
                        const prompts = result.prompts || [];

                        if (prompts.length === 0) {
                            chrome.contextMenus.create({
                                id: "promptvault-empty",
                                parentId: "promptvault-parent",
                                title: "(No saved prompts yet)",
                                enabled: false,
                                contexts: ["editable"]
                            });
                            resolve();
                            return;
                        }

                        let remaining = prompts.length;
                        prompts.forEach((prompt, index) => {
                            chrome.contextMenus.create(
                                {
                                    id: "prompt-" + index,
                                    parentId: "promptvault-parent",
                                    title: prompt.title,
                                    contexts: ["editable"]
                                },
                                () => {
                                    if (chrome.runtime.lastError) {
                                        console.error("Child creation error:", chrome.runtime.lastError.message);
                                    }
                                    remaining--;
                                    if (remaining === 0) resolve();
                                }
                            );
                        });
                    });
                }
            );
        });
    });
}

chrome.runtime.onInstalled.addListener(() => {
    queueMenuRebuild();
});

chrome.runtime.onStartup.addListener(() => {
    queueMenuRebuild();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.prompts) {
        queueMenuRebuild();
    }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (!info.menuItemId.startsWith("prompt-")) {
        return;
    }

    const index = parseInt(info.menuItemId.replace("prompt-", ""));

    chrome.storage.local.get("prompts", (result) => {
        const prompts = result.prompts || [];
        const prompt = prompts[index];

        if (!prompt) {
            return;
        }

        chrome.tabs.sendMessage(tab.id, {
            action: "insertPrompt",
            text: prompt.body
        });
    });
});