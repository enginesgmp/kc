const API_URL =
  "https://script.google.com/macros/s/AKfycbxrs0OaK7oJgbMAlWEGFD_aVRRXGxsX_gDY9qLKjEGvbfGYdJxmT3hwK4o5XlWxOv4LOA/exec";

const DRAFT_KEY_PREFIX = "KC_DRAFT_";
const QUESTIONS_PER_GROUP = 5;
const AUTOSAVE_INTERVAL_MS = 60000;

let currentSession = null;
let currentGroupIndex = 0;
let autosaveTimer = null;

document.addEventListener("DOMContentLoaded", async () => {
  await cargarConfiguracion();

  document
    .getElementById("btn_continue")
    .addEventListener("click", continuar);

  document
    .getElementById("person_name")
    .addEventListener("input", updateInitialButtonState);

  document
    .getElementById("position")
    .addEventListener("input", updateInitialButtonState);

  document
    .getElementById("area_select")
    .addEventListener("change", updateInitialButtonState);

  document
    .getElementById("level_select")
    .addEventListener("change", updateInitialButtonState);

  const resumeBtn = document.getElementById("btn_resume_draft");
  const discardBtn = document.getElementById("btn_discard_draft");

  if (resumeBtn) {
    resumeBtn.addEventListener("click", resumeDraftDirectly);
  }

  if (discardBtn) {
    discardBtn.addEventListener("click", discardDetectedDraft);
  }

  detectarBorradorInicial();
  updateInitialButtonState();
});

async function cargarConfiguracion() {
  try {
    setStatus("Cargando configuración...");

    const response = await fetch(`${API_URL}?action=getAdminData`);
    const result = await response.json();

    if (!result.ok) {
      throw new Error(result.message);
    }

    cargarAreas(result.data.areas);
    cargarLevels(result.data.levels);

    setStatus("Configuración cargada correctamente.");
  } catch (error) {
    console.error(error);
    setStatus("Error cargando configuración.");
  }
}

function cargarAreas(areas) {
  const select = document.getElementById("area_select");

  select.innerHTML = `<option value="">Seleccione área</option>`;

   areas.forEach(area => {
    const option = document.createElement("option");
    option.value = area.area_id;
    option.textContent = area.area_name;
    option.dataset.file = area.json_file;
    select.appendChild(option);
  });
  
  updateInitialButtonState();
}

function updateInitialButtonState() {
  const personName =
    document.getElementById("person_name").value.trim();

  const position =
    document.getElementById("position").value.trim();

  const area =
    document.getElementById("area_select").value;

  const level =
    document.getElementById("level_select").value;

  const btn =
    document.getElementById("btn_continue");

  if (!btn) return;

  btn.disabled =
    !(personName && position && area && level);
}

function cargarLevels(levels) {
  const select = document.getElementById("level_select");

  select.innerHTML = `<option value="">Seleccione nivel</option>`;

  levels.forEach(level => {
    const option = document.createElement("option");
    option.value = level.level_id;
    option.textContent = level.level_name;
    option.dataset.file = level.json_file;
    select.appendChild(option);
  });

  updateInitialButtonState();
}

async function continuar() {
  const personName =
    document.getElementById("person_name").value.trim();

  const position =
    document.getElementById("position").value.trim();

  const areaSelect =
    document.getElementById("area_select");

  const levelSelect =
    document.getElementById("level_select");

  const area =
    areaSelect.value;

  const level =
    levelSelect.value;

  if (!personName || !position || !area || !level) {
    alert("Complete nombre, cargo, área y nivel.");
    return;
  }

  try {
    setStatus("Preparando banco de preguntas...");

    const areaOption =
      areaSelect.options[areaSelect.selectedIndex];

    const levelOption =
      levelSelect.options[levelSelect.selectedIndex];

    const areaFile =
      areaOption.dataset.file;

    const levelFile =
      levelOption.dataset.file;

    const commonUrl =
      "./questionnaires/common/kc_v_2_common.json";

    const levelUrl =
      "./questionnaires/" + levelFile;

    const areaUrl =
      "./questionnaires/" + areaFile;

    const [
      commonResponse,
      levelResponse,
      areaResponse
    ] = await Promise.all([
      fetch(commonUrl),
      fetch(levelUrl),
      fetch(areaUrl)
    ]);

    if (!commonResponse.ok) {
      throw new Error("No se pudo cargar el cuestionario común.");
    }

    if (!levelResponse.ok) {
      throw new Error("No se pudo cargar el cuestionario del nivel.");
    }

    if (!areaResponse.ok) {
      throw new Error("No se pudo cargar el cuestionario del área.");
    }

    const commonData =
      await commonResponse.json();

    const levelData =
      await levelResponse.json();

    const areaData =
      await areaResponse.json();

    const allBlocks = [
      ...(commonData.blocks || []),
      ...(levelData.blocks || []),
      ...(areaData.blocks || [])
    ];

    allBlocks.sort((a, b) =>
      Number(a.order || 0) - Number(b.order || 0)
    );

    const flatQuestions =
      flattenQuestions(allBlocks);

    const questionGroups =
      groupQuestions(flatQuestions, QUESTIONS_PER_GROUP);

    const sessionId =
      crearSessionId();

    currentSession = {
      session_id: sessionId,
      person_name: personName,
      position: position,
      area_id: area,
      area_name: areaOption.textContent,
      area_file: areaFile,
      level_id: level,
      level_name: levelOption.textContent,
      level_file: levelFile,
      session_started_at: new Date().toISOString(),
      last_saved_at: null,
      current_group_index: 0,
      questions: flatQuestions,
      question_groups: questionGroups,
      answers: {},
      completed_groups: []
    };

    const existingDraft =
      findExistingDraft(personName, area, level);

    if (existingDraft) {
      const resume = confirm(
        "Tienes una captura en progreso en este dispositivo.\n\n¿Deseas continuar desde el último avance guardado?"
      );

      if (resume) {
        currentSession = existingDraft;
        currentGroupIndex =
          existingDraft.current_group_index || 0;
      } else {
        clearDraft(existingDraft.session_id);
        currentGroupIndex = 0;
        saveDraft();
      }
    } else {
      currentGroupIndex = 0;
      saveDraft();
    }

document
  .getElementById("initial_card")
  .classList.add("hidden");

document
  .getElementById("hero_header")
  .classList.add("hidden");

const resumeCard =
  document.getElementById("resume_card");

if (resumeCard) {
  resumeCard.classList.add("hidden");
}

document
  .getElementById("wizard")
  .classList.remove("hidden");

    startAutosaveTimer();

    document.getElementById("participant_summary").textContent =
      `${currentSession.person_name} · ${currentSession.position} · ${currentSession.area_name} · ${currentSession.level_name}`;

    setStatus("");

    renderQuestionGroup();

  } catch (error) {
    console.error(error);

    setStatus("Error cargando cuestionarios: " + error.message);

    alert(
      "Ocurrió un error cargando el banco de preguntas.\n\n" +
      error.message
    );
  }
}

function flattenQuestions(blocks) {
  const result = [];

  (blocks || []).forEach((block, blockIndex) => {
    const questions =
      block.questions || [];

    questions.forEach((question, questionIndex) => {
      const questionId =
        question.question_id ||
        question.id ||
        `B${blockIndex + 1}_Q${questionIndex + 1}`;

      const questionText =
        question.question ||
        question.question_text ||
        question.text ||
        "Pregunta sin texto";

      result.push({
        question_id: questionId,
        question: questionText,
        required:
          question.required === true ||
          String(question.required).toUpperCase() === "TRUE",
        source_type: block.source_type || "unknown",
        original_block_id:
          block.block_id ||
          block.id ||
          `BLOCK_${blockIndex + 1}`,
        original_block_name:
          block.block_name ||
          block.name ||
          "Bloque sin nombre",
        objective: block.objective || "",
        order: result.length + 1
      });
    });
  });

  return result;
}

function groupQuestions(questions, size) {
  const groups = [];

  for (let i = 0; i < questions.length; i += size) {
    groups.push({
      group_id: `GROUP_${String(groups.length + 1).padStart(3, "0")}`,
      group_number: groups.length + 1,
      questions: questions.slice(i, i + size)
    });
  }

  return groups;
}

function renderQuestionGroup() {
  const groups =
    currentSession.question_groups;

  const group =
    groups[currentGroupIndex];

  if (!group) {
    renderFinalScreen();
    return;
  }

  const totalQuestions =
    currentSession.questions.length;

  const answeredQuestions =
    countAnsweredQuestions();

  const progressPercent =
    totalQuestions
      ? Math.round((answeredQuestions / totalQuestions) * 100)
      : 0;

  document.getElementById("progress_fill").style.width =
    progressPercent + "%";

  document.getElementById("progress_percent").textContent =
    progressPercent + "%";

document.getElementById("group_title").textContent =
  "Bloque de preguntas";

document.getElementById("group_subtitle").textContent =
  "Responde las preguntas visibles para continuar con el siguiente bloque.";

  const questionsContainer =
    document.getElementById("questions_container");

  questionsContainer.innerHTML = "";

  group.questions.forEach((question, index) => {
    const savedAnswer =
      currentSession.answers[question.question_id] || "";

    const completed =
      savedAnswer.trim().length > 0;

    const item =
      document.createElement("div");

    item.className =
      completed
        ? "question-item completed"
        : "question-item pending";

    item.dataset.questionId =
      question.question_id;

    item.innerHTML = `
      <button class="question-toggle" type="button">
        <span class="check-icon">${completed ? "✓" : ""}</span>
        <span class="question-label">Pregunta ${index + 1}</span>
        <span class="question-state">${completed ? "Completada" : "Pendiente"}</span>
      </button>

      <div class="question-panel">
        <p class="question-text">${escapeHtml(question.question)}</p>

        <textarea
          data-question-id="${escapeHtml(question.question_id)}"
          placeholder="Escriba su respuesta con el mayor detalle posible..."
        >${escapeHtml(savedAnswer)}</textarea>
      </div>
    `;

    questionsContainer.appendChild(item);
  });

  document
    .querySelectorAll(".question-toggle")
    .forEach(button => {
button.addEventListener("click", () => {
  const item =
    button.closest(".question-item");

  item.classList.toggle("open");

  if (item.classList.contains("open")) {
    currentSession.current_open_question_id =
      item.dataset.questionId;
  } else if (
    currentSession.current_open_question_id === item.dataset.questionId
  ) {
    currentSession.current_open_question_id = null;
  }

  currentSession.current_group_index =
    currentGroupIndex;

  saveDraft();
});
    });

  document
    .querySelectorAll("#questions_container textarea")
    .forEach(textarea => {
      textarea.addEventListener("input", onAnswerInput);
    });

restoreOpenQuestionInCurrentGroup();
updateGroupCompletion();
updatePreviousGroupButton();
updateAutosaveText();
}

function restoreOpenQuestionInCurrentGroup() {
  const group =
    currentSession.question_groups[currentGroupIndex];

  if (!group) return;

  let questionToOpen =
    currentSession.current_open_question_id;

  const belongsToCurrentGroup =
    group.questions.some(question =>
      question.question_id === questionToOpen
    );

  if (!questionToOpen || !belongsToCurrentGroup) {
    const firstPending =
      group.questions.find(question => {
        const answer =
          currentSession.answers[question.question_id] || "";

        return answer.trim().length === 0;
      });

    questionToOpen =
      firstPending
        ? firstPending.question_id
        : group.questions[0]?.question_id;
  }

  if (!questionToOpen) return;

  const item =
    document.querySelector(
      `.question-item[data-question-id="${CSS.escape(questionToOpen)}"]`
    );

  if (item) {
    item.classList.add("open");
    currentSession.current_open_question_id = questionToOpen;
    saveDraft();
  }
}

function onAnswerInput(event) {
  const textarea =
    event.target;

  const questionId =
    textarea.dataset.questionId;

  const value =
    textarea.value.trim();

  currentSession.answers[questionId] =
    value;

  currentSession.last_saved_at =
    new Date().toISOString();

  currentSession.current_group_index =
    currentGroupIndex;

  updateQuestionStatus(questionId, value);
  updateGroupCompletion();
  saveDraft();
  updateAutosaveText();
}

function updateQuestionStatus(questionId, value) {
  const item =
    document.querySelector(
      `.question-item[data-question-id="${CSS.escape(questionId)}"]`
    );

  if (!item) return;

  const isCompleted =
    value.trim().length > 0;

  item.classList.toggle("completed", isCompleted);
  item.classList.toggle("pending", !isCompleted);

  const check =
    item.querySelector(".check-icon");

  const state =
    item.querySelector(".question-state");

  check.textContent =
    isCompleted ? "✓" : "";

  state.textContent =
    isCompleted ? "Completada" : "Pendiente";
}

function updateGroupCompletion() {
  const group =
    currentSession.question_groups[currentGroupIndex];

  const completed =
    group.questions.every(question => {
      const answer =
        currentSession.answers[question.question_id] || "";

      return answer.trim().length > 0;
    });

  const btn =
    document.getElementById("btn_save_block");

  const status =
    document.getElementById("group_status");

  btn.disabled =
    !completed;

  btn.textContent =
    completed
      ? "Guardar avance y continuar"
      : "Complete las preguntas para continuar";

status.textContent =
  completed ? "Bloque completo" : "Pendiente";

  status.className =
    completed
      ? "group-status complete"
      : "group-status pending";

  btn.onclick =
    completed ? guardarAvanceYContinuar : null;
}

function updatePreviousGroupButton() {
  const btn =
    document.getElementById("btn_prev_group");

  if (!btn) return;

  btn.disabled =
    currentGroupIndex === 0;

  btn.onclick =
    currentGroupIndex > 0 ? volverBloqueAnterior : null;
}

function volverBloqueAnterior() {
  if (currentGroupIndex <= 0) return;

  currentGroupIndex--;

  currentSession.current_group_index =
    currentGroupIndex;

  currentSession.last_saved_at =
    new Date().toISOString();

  saveDraft();
  renderQuestionGroup();
  window.scrollTo(0, 0);
}

function guardarAvanceYContinuar() {
  const groupId =
    currentSession.question_groups[currentGroupIndex].group_id;

  if (!currentSession.completed_groups.includes(groupId)) {
    currentSession.completed_groups.push(groupId);
  }

  currentSession.current_group_index =
    currentGroupIndex;

  currentSession.last_saved_at =
    new Date().toISOString();

  saveDraft();
  updateAutosaveText();

  if (currentGroupIndex < currentSession.question_groups.length - 1) {
    currentGroupIndex++;
    currentSession.current_group_index =
      currentGroupIndex;

    saveDraft();
    renderQuestionGroup();
    window.scrollTo(0, 0);
  } else {
    renderFinalScreen();
  }
}

function renderFinalScreen() {
  const totalQuestions =
    currentSession.questions.length;

  const answeredQuestions =
    countAnsweredQuestions();

  document.getElementById("progress_fill").style.width =
    "100%";

  document.getElementById("progress_percent").textContent =
    "100%";

  document.getElementById("wizard").innerHTML = `
    <div class="card final-card">
      <h2>Captura lista para envío</h2>
      <p>Se han completado las respuestas requeridas para esta captura.</p>

      <div class="final-summary">
        <div><strong>Participante:</strong> ${escapeHtml(currentSession.person_name)}</div>
        <div><strong>Cargo:</strong> ${escapeHtml(currentSession.position)}</div>
        <div><strong>Área:</strong> ${escapeHtml(currentSession.area_name)}</div>
        <div><strong>Nivel:</strong> ${escapeHtml(currentSession.level_name)}</div>
        <div><strong>Preguntas respondidas:</strong> ${answeredQuestions} de ${totalQuestions}</div>
      </div>

      <button id="btn_submit_final">
        Enviar respuestas finales
      </button>

      <p class="final-note">
        Al enviar, se registrará un único JSON final con todo el conocimiento capturado.
      </p>
    </div>
  `;

  document.getElementById("btn_submit_final").onclick =
    submitFinalResponse;
}

async function submitFinalResponse() {
  try {
    const totalQuestions =
      currentSession.questions.length;

    const answeredQuestions =
      countAnsweredQuestions();

    if (answeredQuestions < totalQuestions) {
      alert("Aún existen preguntas pendientes.");
      return;
    }

    setStatus("Enviando respuestas finales...");

    const payload =
      buildFinalPayload();

    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "submitFinal",
        payload: payload
      })
    });

    const result =
      await response.json();

    if (!result.ok) {
      throw new Error(
        result.message ||
        "Error enviando respuestas finales."
      );
    }

    clearDraft(currentSession.session_id);
    stopAutosaveTimer();

    setStatus("Respuestas enviadas correctamente.");

    document.getElementById("wizard").innerHTML = `
      <div class="card final-card success">
        <h2>Respuestas enviadas correctamente</h2>
        <p>Gracias. La captura de conocimiento fue registrada exitosamente.</p>
        <p>Ya puede cerrar esta página.</p>
      </div>
    `;

  } catch (error) {
    console.error(error);

    setStatus("Error enviando respuestas: " + error.message);

    alert(
      "No se pudo enviar la captura final.\n\n" +
      error.message
    );
  }
}

function buildFinalPayload() {
  const completedAt =
    new Date().toISOString();

  return {
    metadata: {
      system: "Knowledge Capture",
      version: "KC_V2",
      session_id: currentSession.session_id,
      person_name: currentSession.person_name,
      position: currentSession.position,
      area_id: currentSession.area_id,
      area_name: currentSession.area_name,
      level_id: currentSession.level_id,
      level_name: currentSession.level_name,
      started_at: currentSession.session_started_at,
      completed_at: completedAt,
      status: "completed",
      total_questions: currentSession.questions.length,
      answered_questions: countAnsweredQuestions()
    },
    answers: currentSession.questions.map(question => ({
      question_id: question.question_id,
      source_type: question.source_type,
      original_block_id: question.original_block_id,
      original_block_name: question.original_block_name,
      question: question.question,
      answer: currentSession.answers[question.question_id] || ""
    }))
  };
}

function saveDraft() {
  if (!currentSession) return;

  const key =
    getDraftKey(currentSession.session_id);

  localStorage.setItem(
    key,
    JSON.stringify(currentSession)
  );

  localStorage.setItem(
    "KC_LAST_DRAFT_SESSION",
    currentSession.session_id
  );
}

function detectarBorradorInicial() {
  const draft =
    getLastDraft();

  if (!draft) return;

  const resumeCard =
    document.getElementById("resume_card");

  const resumeSummary =
    document.getElementById("resume_summary");

  if (!resumeCard || !resumeSummary) return;

  const dateText =
    draft.last_saved_at
      ? formatLocalTime(draft.last_saved_at)
      : "sin hora registrada";

  resumeSummary.textContent =
    `Se encontró una captura guardada de ${draft.person_name || "usuario"} · ${draft.position || "cargo no definido"} · ${draft.area_name || "área no definida"} · ${draft.level_name || "nivel no definido"}. Último guardado local: ${dateText}.`;

  document
    .getElementById("hero_header")
    .classList.add("hidden");

  document
    .getElementById("initial_card")
    .classList.add("hidden");

  document
    .getElementById("wizard")
    .classList.add("hidden");

  resumeCard.classList.remove("hidden");

  setStatus("");
}

function getLastDraft() {
  const lastSessionId =
    localStorage.getItem("KC_LAST_DRAFT_SESSION");

  if (!lastSessionId) return null;

  const raw =
    localStorage.getItem(getDraftKey(lastSessionId));

  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn("No se pudo leer el borrador local.", error);
    return null;
  }
}

function resumeDraftDirectly() {
  const draft =
    getLastDraft();

  if (!draft) {
    alert("No se encontró una captura guardada.");
    return;
  }

  currentSession = draft;
  currentGroupIndex = draft.current_group_index || 0;

document
  .getElementById("initial_card")
  .classList.add("hidden");

document
  .getElementById("hero_header")
  .classList.add("hidden");

document
  .getElementById("resume_card")
  .classList.add("hidden");

document
  .getElementById("wizard")
  .classList.remove("hidden");

  document.getElementById("participant_summary").textContent =
    `${currentSession.person_name} · ${currentSession.position} · ${currentSession.area_name} · ${currentSession.level_name}`;

  startAutosaveTimer();
  setStatus("");

  renderQuestionGroup();
  window.scrollTo(0, 0);
}

function discardDetectedDraft() {
  const draft =
    getLastDraft();

  if (draft) {
    clearDraft(draft.session_id);
  }

  currentSession = null;
  currentGroupIndex = 0;
  stopAutosaveTimer();

  document
    .getElementById("resume_card")
    .classList.add("hidden");

  document
    .getElementById("hero_header")
    .classList.remove("hidden");

  document
    .getElementById("initial_card")
    .classList.remove("hidden");

  document
    .getElementById("wizard")
    .classList.add("hidden");

  document.getElementById("person_name").value = "";
  document.getElementById("position").value = "";
  document.getElementById("area_select").value = "";
  document.getElementById("level_select").value = "";

  updateInitialButtonState();

  setStatus("Inicio limpio. Puedes comenzar una nueva captura.");
}

function formatLocalTime(isoString) {
  const date =
    new Date(isoString);

  const hh =
    String(date.getHours()).padStart(2, "0");

  const mm =
    String(date.getMinutes()).padStart(2, "0");

  return `${hh}:${mm}`;
}

function findExistingDraft(personName, areaId, levelId) {
  const lastSessionId =
    localStorage.getItem("KC_LAST_DRAFT_SESSION");

  if (!lastSessionId) return null;

  const raw =
    localStorage.getItem(getDraftKey(lastSessionId));

  if (!raw) return null;

  try {
    const draft =
      JSON.parse(raw);

    const samePerson =
      String(draft.person_name || "").trim().toLowerCase() ===
      String(personName || "").trim().toLowerCase();

    const sameArea =
      draft.area_id === areaId;

    const sameLevel =
      draft.level_id === levelId;

    if (samePerson && sameArea && sameLevel) {
      return draft;
    }

    return null;

  } catch (error) {
    return null;
  }
}

function clearDraft(sessionId) {
  localStorage.removeItem(
    getDraftKey(sessionId)
  );

  localStorage.removeItem(
    "KC_LAST_DRAFT_SESSION"
  );
}

function getDraftKey(sessionId) {
  return DRAFT_KEY_PREFIX + sessionId;
}

function updateAutosaveText() {
  const el =
    document.getElementById("autosave_text");

  if (!el || !currentSession) return;

  if (!currentSession.last_saved_at) {
    el.textContent =
      "Guardado local activo";
    return;
  }

  const date =
    new Date(currentSession.last_saved_at);

  const hh =
    String(date.getHours()).padStart(2, "0");

  const mm =
    String(date.getMinutes()).padStart(2, "0");

  el.textContent =
    `Último guardado local: ${hh}:${mm}`;
}

function countAnsweredQuestions() {
  if (!currentSession) return 0;

  return currentSession.questions.filter(question => {
    const answer =
      currentSession.answers[question.question_id] || "";

    return answer.trim().length > 0;
  }).length;
}

function startAutosaveTimer() {
  stopAutosaveTimer();

  autosaveTimer = setInterval(() => {
    if (!currentSession) return;

    currentSession.last_saved_at =
      new Date().toISOString();

    currentSession.current_group_index =
      currentGroupIndex;

    saveDraft();
    updateAutosaveText();

    console.log(
      "Autosave local ejecutado:",
      currentSession.last_saved_at
    );
  }, AUTOSAVE_INTERVAL_MS);
}

function stopAutosaveTimer() {
  if (autosaveTimer) {
    clearInterval(autosaveTimer);
    autosaveTimer = null;
  }
}

function crearSessionId() {
  const now =
    new Date();

  const stamp =
    now
      .toISOString()
      .replace(/[-:T.Z]/g, "")
      .slice(0, 14);

  const random =
    Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase();

  return "KC_" + stamp + "_" + random;
}

function setStatus(message) {
  document.getElementById("status").textContent =
    message;
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
