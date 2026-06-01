const API_URL =
  "https://script.google.com/macros/s/AKfycbxrs0OaK7oJgbMAlWEGFD_aVRRXGxsX_gDY9qLKjEGvbfGYdJxmT3hwK4o5XlWxOv4LOA/exec";

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

    setStatus(
      "Cuestionarios cargados correctamente. Bloques detectados: " + allBlocks.length
    );

    alert(
      "Carga exitosa.\nBloques detectados: " + allBlocks.length
    );

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
