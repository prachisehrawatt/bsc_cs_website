/* B.Sc. Computer Science Course Hub
   Resource data is centralized in data/resources.json locally and can be
   served from Cloudflare Pages Functions + D1 in production.
*/

const SEMESTERS = [
  { n: 1, slug: "sem-1", label: "Semester 1" },
  { n: 2, slug: "sem-2", label: "Semester 2" },
  { n: 3, slug: "sem-3", label: "Semester 3" },
  { n: 4, slug: "sem-4", label: "Semester 4" },
  { n: 5, slug: "sem-5", label: "Semester 5" },
  { n: 6, slug: "sem-6", label: "Semester 6" },
  { n: 7, slug: "sem-7", label: "Semester 7" },
  { n: 8, slug: "sem-8", label: "Semester 8" },
];

const CATEGORY_LABELS = {
  notes: "Notes",
  tutorials: "Tutorials",
  practicals: "Practical Files",
  project: "Project Files",
  pyqs: "PYQs",
};

const SUBJECTS_CACHE = new Map();

async function loadSubjects(semester) {
  try {
    const api = await fetch(`/api/subjects?semester=${semester}`, { headers: { Accept: "application/json" } });
    if (api.ok) {
      const data = await api.json();
      if (Array.isArray(data.subjects)) return data.subjects;
    }
  } catch (_) {}

  const localKey = `bsc-subjects-sem-${semester}`;
  try {
    const local = JSON.parse(localStorage.getItem(localKey) || "null");
    if (Array.isArray(local)) return local;
  } catch (_) {}

  const fallback = await fetch(`${getRootPrefix()}sem-${semester}/data/subjects.json`);
  if (!fallback.ok) throw new Error("Unable to load subject data");
  return await fallback.json();
}


function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeResourceUrl(resource) {
  if (resource.url) return resource.url;
  if (resource.file) return resource.file;
  return "#";
}

async function loadResources() {
  if (window.__RESOURCE_CACHE) return window.__RESOURCE_CACHE;

  try {
    const api = await fetch("/api/resources", { headers: { Accept: "application/json" } });
    if (api.ok) {
      const data = await api.json();
      if (Array.isArray(data.resources)) {
        window.__RESOURCE_CACHE = data.resources;
        return window.__RESOURCE_CACHE;
      }
    }
  } catch (_) {}

  const fallback = await fetch(getRootPrefix() + "data/resources.json");
  if (!fallback.ok) throw new Error("Unable to load resource data");
  window.__RESOURCE_CACHE = await fallback.json();
  return window.__RESOURCE_CACHE;
}

function getRootPrefix() {
  const depth = window.location.pathname.split("/").filter(Boolean).length;
  // Pages are always under /sem-N/...; the home page is one level shallower.
  if (window.location.pathname.includes("/sem-")) {
    const parts = window.location.pathname.split("/").filter(Boolean);
    const semIndex = parts.findIndex((p) => /^sem-\d+$/.test(p));
    const afterSem = parts.length - semIndex - 1;
    return "../".repeat(afterSem + 1);
  }
  return "";
}

function initSemNav(root, activeSem) {
  const list = document.getElementById("semnav-list");
  if (!list) return;
  list.innerHTML = SEMESTERS.map((s) => `
    <li class="semnav__item">
      <a href="${root}${s.slug}/index.html" class="${s.n === activeSem ? "active" : ""}">
        <span class="semnav__num">${String(s.n).padStart(2, "0")}</span> ${s.label}
      </a>
    </li>
  `).join("");
}

async function renderSubjectGrid(semSlug) {
  const grid = document.getElementById("subject-grid");
  if (!grid) return;
  try {
    const subjects = await loadSubjects(Number(semSlug.replace("sem-", "")));
    const resources = await loadResources();
    const semNumber = Number(semSlug.replace("sem-", ""));

    grid.innerHTML = subjects.map((sub, i) => {
      const count = resources.filter((r) => Number(r.semester) === semNumber && r.subject === sub.slug).length;
      return `
        <a class="subject-card" href="../subject.html?sem=${semNumber}&subject=${encodeURIComponent(sub.slug)}">
          <span class="subject-card__tab">${String(i + 1).padStart(2, "0")}</span>
          <div class="subject-card__title">${escapeHtml(sub.name)}</div>
          <div class="subject-card__meta">${count} ${count === 1 ? "file" : "files"}</div>
        </a>
      `;
    }).join("");
  } catch (e) {
    grid.outerHTML = emptyState("Unable to load subjects/resources.", "sem-N/data/subjects.json");
  }
}

function subjectSlugFromPath() {
  const query = new URLSearchParams(window.location.search);
  if (query.get("subject")) return query.get("subject");
  const parts = window.location.pathname.split("/").filter(Boolean);
  const semIndex = parts.findIndex((p) => /^sem-\d+$/.test(p));
  return semIndex >= 0 && parts[semIndex + 1] ? parts[semIndex + 1] : null;
}

function semesterNumberFromPath() {
  const query = new URLSearchParams(window.location.search);
  if (query.get("sem")) return Number(query.get("sem"));
  const match = window.location.pathname.match(/\/sem-(\d+)\//);
  return match ? Number(match[1]) : 1;
}

async function renderSubjectDetail() {
  const tabbar = document.getElementById("tabbar");
  const panel = document.getElementById("file-panel");
  if (!tabbar || !panel) return;

  const subjectSlug = subjectSlugFromPath();
  const semester = semesterNumberFromPath();
  if (!subjectSlug) return;

  try {
    const resources = await loadResources();
    let subjectName = subjectSlug;
    try {
      const subjectsRes = await fetch(`/api/subjects?semester=${semester}`);
      if (subjectsRes.ok) {
        const data = await subjectsRes.json();
        const found = (data.subjects || []).find((s) => s.slug === subjectSlug);
        if (found) subjectName = found.name;
      }
    } catch (_) {}
    if (subjectName === subjectSlug) {
      try {
        const prefix = getRootPrefix();
        const local = await fetch(`${prefix}sem-${semester}/data/subjects.json`);
        if (local.ok) {
          const found = (await local.json()).find((s) => s.slug === subjectSlug);
          if (found) subjectName = found.name;
        }
      } catch (_) {}
    }
    const subjectResources = resources.filter(
      (r) => Number(r.semester) === semester && r.subject === subjectSlug
    );

    const activeCats = Object.keys(CATEGORY_LABELS);
    tabbar.innerHTML = activeCats.map((c, i) => {
      const count = subjectResources.filter((r) => r.category === c).length;
      return `<button data-cat="${c}" class="${i === 0 ? "active" : ""}">${CATEGORY_LABELS[c]} <span class="tab-count">${count}</span></button>`;
    }).join("");

    function showCategory(cat) {
      const files = subjectResources.filter((r) => r.category === cat);
      if (!files.length) {
        panel.innerHTML = emptyState(
          `No ${CATEGORY_LABELS[cat].toLowerCase()} added yet.`,
          "Add Resource"
        );
        return;
      }

      panel.innerHTML = `<ul class="filelist">${files.map((f) => {
        const url = normalizeResourceUrl(f);
        return `
          <li class="filelist__item">
            <div>
              <div class="filelist__name">${escapeHtml(f.name || f.title)}</div>
              ${f.tag ? `<div class="filelist__tag">${escapeHtml(f.tag)}</div>` : ""}
            </div>
            <a class="filelist__link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">View / Open</a>
          </li>
        `;
      }).join("")}</ul>`;
    }

    tabbar.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-cat]");
      if (!btn) return;
      tabbar.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      showCategory(btn.dataset.cat);
    });

    showCategory(activeCats[0]);
  } catch (e) {
    panel.innerHTML = emptyState("Unable to load resources.", "data/resources.json");
  }
}

function emptyState(message, pathHint) {
  return `<div class="empty-state">${escapeHtml(message)}<br><span>Add resources from <code>${escapeHtml(pathHint)}</code>.</span></div>`;
}
