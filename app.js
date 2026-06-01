const API_URL =
  "https://script.google.com/macros/s/AKfycbxrs0OaK7oJgbMAlWEGFD_aVRRXGxsX_gDY9qLKjEGvbfGYdJxmT3hwK4o5XlWxOv4LOA/exec";


let currentSession = null;
let currentBlockIndex = 0;
let blockAnswers = {};

document.addEventListener("DOMContentLoaded", async () => {
  await cargarConfiguracion();

  document
    .getElementById("btn_continue")
    .addEventListener("click", continuar);
});

async function cargarConfiguracion() {
  try {

    setStatus("Cargando configuración...");

    const response = await fetch(
      `${API_URL}?action=getAdminData`
    );

    const result = await response.json();

    if (!result.ok) {
      throw new Error(result.message);
    }

    cargarAreas(result.data.areas);
    cargarLevels(result.data.levels);

    setStatus("Configuración cargada.");

  } catch (error) {
    console.error(error);
    setStatus("Error cargando configuración.");
  }
}

function cargarAreas(areas) {
  const select = document.getElementById("area_select");

  select.innerHTML = `
    <option value="">Seleccione área</option>
  `;

  areas.forEach(area => {
    const option = document.createElement("option");

    option.value = area.area_id;
    option.textContent = area.area_name;

    option.dataset.file = area.json_file;

    select.appendChild(option);
  });
}

function cargarLevels(levels) {
  const select = document.getElementById("level_select");

  select.innerHTML = `
    <option value="">Seleccione nivel</option>
  `;

  levels.forEach(level => {
    const option = document.createElement("option");

    option.value = level.level_id;
    option.textContent = level.level_name;

    option.dataset.file = level.json_file;

    select.appendChild(option);
  });
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
    alert("Complete todos los campos.");
    return;
  }

  try {

    setStatus("Cargando cuestionarios...");

    const areaFile =
      areaSelect.options[areaSelect.selectedIndex].dataset.file;

    const levelFile =
      levelSelect.options[levelSelect.selectedIndex].dataset.file;

    const commonUrl =
      "./questionnaires/common/kc_v_2_common.json";

    const levelUrl =
      "./questionnaires/" + levelFile;

    const areaUrl =
      "./questionnaires/" + areaFile;

    console.log("Cargando common:", commonUrl);
    console.log("Cargando nivel:", levelUrl);
    console.log("Cargando área:", areaUrl);

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
      throw new Error("No se pudo cargar common: " + commonUrl);
    }

    if (!levelResponse.ok) {
      throw new Error("No se pudo cargar nivel: " + levelUrl);
    }

    if (!areaResponse.ok) {
      throw new Error("No se pudo cargar área: " + areaUrl);
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

console.log("BLOQUES CONSOLIDADOS:");
console.log(allBlocks);

const areaOption =
  areaSelect.options[areaSelect.selectedIndex];

const levelOption =
  levelSelect.options[levelSelect.selectedIndex];

currentSession = {
  session_id: crearSessionId(),
  person_name: personName,
  position: position,
  area_id: area,
  area_name: areaOption.textContent,
  area_file: areaFile,
  level_id: level,
  level_name: levelOption.textContent,
  level_file: levelFile,
  session_started_at: new Date().toISOString(),
  blocks: allBlocks
};

currentBlockIndex = 0;
blockAnswers = {};

document.querySelector(".card").classList.add("hidden");
document.getElementById("wizard").classList.remove("hidden");

setStatus(
  "Cuestionarios cargados correctamente. Bloques detectados: " + allBlocks.length
);

renderCurrentBlock();

  } catch (error) {

    console.error(error);

    setStatus("Error cargando cuestionarios: " + error.message);

    alert(
      "Ocurrió un error cargando los cuestionarios.\n\n" + error.message
    );
  }
}

function setStatus(message) {
  document.getElementById("status").textContent = message;
}

function renderCurrentBlock() {
  if (!currentSession || !currentSession.blocks.length) {
    setStatus("No hay bloques disponibles.");
    return;
  }

  const block = currentSession.blocks[currentBlockIndex];
  const totalBlocks = currentSession.blocks.length;
  const currentNumber = currentBlockIndex + 1;

  document.getElementById("progress_text").textContent =
    "Bloque " + currentNumber + " de " + totalBlocks;

  const progressPercent =
    (currentNumber / totalBlocks) * 100;

  document.getElementById("progress_fill").style.width =
    progressPercent + "%";

  document.getElementById("block_title").textContent =
    block.block_name || block.name || "Bloque sin nombre";

  document.getElementById("block_objective").textContent =
    block.objective || "";

  const questionsContainer =
    document.getElementById("questions_container");

  questionsContainer.innerHTML = "";

  const questions =
    block.questions || [];

  if (!questions.length) {
    questionsContainer.innerHTML =
      "<p>Este bloque no tiene preguntas configuradas.</p>";
  }

  questions.forEach((question, index) => {
    const questionId =
      question.question_id ||
      question.id ||
      "Q_" + index;

    const questionText =
      question.question ||
      question.question_text ||
      question.text ||
      "Pregunta sin texto";

    const required =
      question.required === true ||
      String(question.required).toUpperCase() === "TRUE";

    const box = document.createElement("div");
    box.className = "question-box";

    box.innerHTML = `
      <label>
        ${index + 1}. ${escapeHtml(questionText)}
        ${required ? '<span class="required">*</span>' : ''}
      </label>

      <textarea
        data-question-id="${escapeHtml(questionId)}"
        data-question-text="${escapeHtml(questionText)}"
        data-required="${required}"
        placeholder="Escriba su respuesta aquí..."
      ></textarea>
    `;

    questionsContainer.appendChild(box);
  });

  const btn =
    document.getElementById("btn_save_block");

  btn.onclick = cerrarBloqueActual;
}

function cerrarBloqueActual() {
  const block =
    currentSession.blocks[currentBlockIndex];

  const textareas =
    document.querySelectorAll("#questions_container textarea");

  const answers = [];

  for (const textarea of textareas) {
    const answer =
      textarea.value.trim();

    const required =
      textarea.dataset.required === "true";

    if (required && !answer) {
      alert("Debe responder todas las preguntas obligatorias.");
      textarea.focus();
      return;
    }

    answers.push({
      question_id: textarea.dataset.questionId,
      question: textarea.dataset.questionText,
      answer: answer
    });
  }

  const blockId =
    block.block_id || block.id || "BLOCK_" + (currentBlockIndex + 1);

  blockAnswers[blockId] = answers;

  console.log("Bloque cerrado:");
  console.log({
    block: block,
    answers: answers
  });

  if (currentBlockIndex < currentSession.blocks.length - 1) {
    currentBlockIndex++;
    renderCurrentBlock();
    window.scrollTo(0, 0);
  } else {
    finalizarCaptura();
  }
}

function finalizarCaptura() {
  setStatus("Captura finalizada. Todos los bloques fueron completados.");

  document.getElementById("wizard").innerHTML = `
    <div class="card">
      <h2>Captura finalizada</h2>
      <p>Se completaron todos los bloques de preguntas.</p>
      <p>En el siguiente paso se activará el guardado en Drive por cada bloque cerrado.</p>
    </div>
  `;

  console.log("RESPUESTAS COMPLETAS:");
  console.log(blockAnswers);
}

function crearSessionId() {
  const now = new Date();

  const stamp = now
    .toISOString()
    .replace(/[-:T.Z]/g, "")
    .slice(0, 14);

  const random = Math.random()
    .toString(36)
    .substring(2, 8)
    .toUpperCase();

  return "KC_" + stamp + "_" + random;
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
