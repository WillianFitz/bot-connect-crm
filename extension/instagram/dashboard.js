document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.sync.get(["profiles"], (data) => {
    const profiles = data.profiles || {};
    const entries = Object.entries(profiles);
    const body = document.getElementById("profilesBody");
    body.innerHTML = "";

    if (!entries.length) {
      body.innerHTML =
        '<tr><td colspan="4" class="small">Nenhum dado ainda.</td></tr>';
    } else {
      let total = 0;
      entries.forEach(([key, value]) => {
        const match = key.match(/^profile:(.+?):(.+)$/);
        const tenantId = match ? match[1] : "-";
        const profile = match ? match[2] : key;
        const totalCaptured = value.totalCaptured || 0;
        const lastIndex = value.lastIndex || 0;
        total += totalCaptured;

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${tenantId}</td>
          <td>${profile}</td>
          <td>${totalCaptured}</td>
          <td>${lastIndex}</td>
        `;
        body.appendChild(tr);
      });

      const summary = document.getElementById("summary");
      summary.textContent = `Total de perfis: ${
        entries.length
      }. Total de seguidores únicos capturados neste navegador: ${total}.`;
    }
  });
});

