document.addEventListener('DOMContentLoaded', async () => {
    // Verifică autentificarea
    const userId = sessionStorage.getItem('userId');
    if (!userId) {
        window.location.href = 'login.html';
        return;
    }

    // Afișează numele medicului în navbar (dacă există endpoint)
    try {
        const res = await fetch(`/api/medic/${userId}`);
        if (res.ok) {
            const medic = await res.json();
            document.getElementById('medic-name').textContent = `Dr. ${medic.nume}`;
        }
    } catch {}

    // Încarcă programările
    const tbody = document.getElementById('all-appointments-tbody');
    try {
        const res = await fetch(`/api/programari/medic/${userId}/all`);
        if (!res.ok) throw new Error('Eroare la încărcarea programărilor');
        const programari = await res.json();
        // Filtrează doar programările din ziua curentă sau viitoare
        const azi = new Date().toISOString().split('T')[0];
        const programariViitoare = programari.filter(p => p.data >= azi);
        if (!Array.isArray(programariViitoare) || programariViitoare.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#888; font-size:1.1em;"><i class="fas fa-calendar-times" style="font-size:1.5em; color:#00b8b8;"></i><br>Nu există programări înregistrate.</td></tr>';
            return;
        }
        tbody.innerHTML = programariViitoare.map(p => `
            <tr>
                <td>${p.data}</td>
                <td>${p.ora}</td>
                <td>${p.nume_pacient}</td>
                <td>${getStatusBadge(p.status)}</td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="4" style="color:red;">Eroare la încărcarea programărilor.</td></tr>';
    }

    // Logout
    document.getElementById('logout-btn').addEventListener('click', (e) => {
        e.preventDefault();
        sessionStorage.removeItem('isLoggedIn');
        sessionStorage.removeItem('userId');
        sessionStorage.removeItem('userType');
        window.location.href = 'login.html';
    });
});

function getStatusBadge(status) {
    switch (status) {
        case 'finalizat':
            return '<span class="status-badge status-finalizat"><i class="fas fa-check-circle"></i> Finalizat</span>';
        case 'neprezentat':
            return '<span class="status-badge status-neprezentat"><i class="fas fa-user-slash"></i> Neprezentat</span>';
        case 'anulata':
            return '<span class="status-badge status-anulata"><i class="fas fa-times-circle"></i> Anulată</span>';
        default:
            return '<span class="status-badge status-programata"><i class="fas fa-calendar-check"></i> Programată</span>';
    }
} 