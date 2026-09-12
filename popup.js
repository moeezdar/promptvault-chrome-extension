document.addEventListener("DOMContentLoaded", () => {
    loadPrompts();

    const searchInput = document.getElementById("searchInput");
    searchInput.addEventListener("input", (e) => filterPrompts(e.target.value));

    document.getElementById("addPromptBtn").addEventListener("click", () => openModal());
    document.getElementById("closeModal").addEventListener("click", closeModal);
    document.getElementById("cancelBtn").addEventListener("click", closeModal);
    document.getElementById("saveBtn").addEventListener("click", savePrompt);
});

let editingIndex = null;

function loadPrompts(filter = "") {
    chrome.storage.local.get(["prompts"], (result) => {
        const prompts = result.prompts || [];
        renderPrompts(prompts, filter);
    });
}

function renderPrompts(prompts, filter) {
    const promptList = document.getElementById("promptList");
    promptList.innerHTML = "";

    const filtered = prompts.filter(p => 
        p.title.toLowerCase().includes(filter.toLowerCase()) || 
        p.body.toLowerCase().includes(filter.toLowerCase())
    );

    if (filtered.length === 0) {
        promptList.innerHTML = `<div class="empty">No prompts found.</div>`;
        return;
    }

    filtered.forEach((prompt) => {
        const originalIndex = prompts.indexOf(prompt);

        const card = document.createElement("div");
        card.className = "prompt-card";
        card.innerHTML = `
            <h3>${escapeHtml(prompt.title)}</h3>
            <p>${escapeHtml(prompt.body)}</p>
            <div class="actions">
                <button class="insert-btn" data-index="${originalIndex}">Insert</button>
                <button class="edit-btn" data-index="${originalIndex}">Edit</button>
                <button class="delete-btn" data-index="${originalIndex}">Delete</button>
            </div>
        `;
        promptList.appendChild(card);
    });

    // Attach event listeners dynamically to avoid CSP violations
    document.querySelectorAll(".insert-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            insertPromptContent(parseInt(e.target.getAttribute("data-index")));
        });
    });

    document.querySelectorAll(".edit-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            openModal(parseInt(e.target.getAttribute("data-index")));
        });
    });

    document.querySelectorAll(".delete-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            deletePrompt(parseInt(e.target.getAttribute("data-index")));
        });
    });
}

function openModal(index = null) {
    editingIndex = index;
    const modal = document.getElementById("modal");
    const modalTitle = document.getElementById("modalTitle");
    const titleInput = document.getElementById("promptTitle");
    const bodyInput = document.getElementById("promptBody");

    if (index !== null) {
        modalTitle.textContent = "Edit Prompt";
        chrome.storage.local.get(["prompts"], (result) => {
            const prompts = result.prompts || [];
            if (prompts[index]) {
                titleInput.value = prompts[index].title;
                bodyInput.value = prompts[index].body;
            }
        });
    } else {
        modalTitle.textContent = "Add Prompt";
        titleInput.value = "";
        bodyInput.value = "";
    }

    modal.classList.remove("hidden");
}

function closeModal() {
    document.getElementById("modal").classList.add("hidden");
    editingIndex = null;
}

function savePrompt() {
    const title = document.getElementById("promptTitle").value.trim();
    const body = document.getElementById("promptBody").value.trim();

    if (!title || !body) {
        showToast("Please fill in both fields.");
        return;
    }

    chrome.storage.local.get(["prompts"], (result) => {
        let prompts = result.prompts || [];

        if (editingIndex !== null) {
            prompts[editingIndex] = { title, body };
        } else {
            prompts.push({ title, body });
        }

        chrome.storage.local.set({ prompts }, () => {
            closeModal();
            loadPrompts();
            showToast("Prompt saved successfully!");
        });
    });
}

function deletePrompt(index) {
    chrome.storage.local.get(["prompts"], (result) => {
        let prompts = result.prompts || [];
        prompts.splice(index, 1);
        chrome.storage.local.set({ prompts }, () => {
            loadPrompts();
            showToast("Prompt deleted.");
        });
    });
}

function insertPromptContent(index) {
    chrome.storage.local.get(["prompts"], (result) => {
        const prompts = result.prompts || [];
        const prompt = prompts[index];

        if (!prompt) return;

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: "insertPrompt",
                    text: prompt.body
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        showToast("Click into a webpage field first!");
                        return;
                    }
                    if (response && response.success) {
                        showToast("Prompt inserted!");
                    } else {
                        showToast("Failed to insert into active field.");
                    }
                });
            }
        });
    });
}

function filterPrompts(query) {
    loadPrompts(query);
}

function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.style.display = "block";
    setTimeout(() => {
        toast.style.display = "none";
    }, 2000);
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}