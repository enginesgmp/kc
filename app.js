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

function continuar() {

  const personName =
    document.getElementById("person_name").value.trim();

  const position =
    document.getElementById("position").value.trim();

  const area =
    document.getElementById("area_select").value;

  const level =
    document.getElementById("level_select").value;

  if (!personName || !position || !area || !level) {
    alert("Complete todos los campos.");
    return;
  }

  console.log({
    personName,
    position,
    area,
    level
  });

  setStatus("Datos iniciales validados.");

  alert("Frontend funcionando correctamente.");
}

function setStatus(message) {
  document.getElementById("status").textContent = message;
}