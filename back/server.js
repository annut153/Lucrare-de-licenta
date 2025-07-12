const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt'); // ✅ Pentru criptare parole
const { startDatabase, getDb } = require('./db');

const app = express();
let db;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'front')));

// Pagina principală
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'front', 'html', 'home.html'));
});

app.get('/scanare_cod.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'front', 'html', 'scanare_cod.html'));
});

// ✅ Înregistrare cu criptare parolă
app.post('/api/auth/register', async (req, res) => {
  try {
    const { nume, prenume, birthdate, email, telefon, parola } = req.body;

    // Hash parolei
    const hashedPassword = await bcrypt.hash(parola, 10);

    const result = await getDb().run(`
      INSERT INTO pacient (nume, prenume, data_nasterii, email, telefon, parola)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [nume, prenume, birthdate, email, telefon, hashedPassword]);

    res.status(201).json({ message: 'Cont creat cu succes!', id: result.lastID });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Eroare la înregistrare' });
  }
});

// ✅ Autentificare cu verificare parolă hashuită
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const isMedic = email.endsWith('@ace.clinic.ro');
    const tipUtilizator = isMedic ? 'medic' : 'pacient';

    // Caută utilizatorul doar după email
    const row = await getDb().get(
      `SELECT * FROM ${tipUtilizator} WHERE email = ?`,
      [email]
    );

    if (!row) return res.status(401).json({ message: 'Email inexistent' });

    // Verifică parola (comparație între ce introduce utilizatorul și hash-ul salvat)
    const passwordMatch = await bcrypt.compare(password, row.parola);

    if (!passwordMatch) {
      return res.status(401).json({ message: 'Parolă incorectă' });
    }

    res.status(200).json({ message: 'Autentificare reușită', [tipUtilizator]: row, tipUtilizator });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Eroare la autentificare' });
  }
});

// Medici disponibili
app.get('/api/medici-disponibili', async (req, res) => {
  const { specializare, data, ora } = req.query;
  try {
    const rows = await getDb().all(`
      SELECT m.id_medic AS id, m.nume, m.rating
      FROM medic m
      WHERE m.specializare = ?
      AND NOT EXISTS (
        SELECT 1 FROM programare p
        WHERE p.id_medic = m.id_medic AND p.data = ? AND p.ora = ? AND p.status != 'anulata'
      )
    `, [specializare, data, ora]);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Eroare la obținerea medicilor disponibili" });
  }
});

// Fișa medicală a pacientului
app.get("/api/fisa/:id_pacient", async (req, res) => {
  try {
    const fisa = await getDb().get("SELECT * FROM fisa_medicala WHERE id_pacient = ?", [req.params.id_pacient]);
    if (!fisa) return res.status(404).json({ error: "Fișă medicală inexistentă" });
    res.json(fisa);
  } catch (err) {
    res.status(500).json({ error: "Eroare server" });
  }
});

// Date pacient
app.get("/api/pacient/:id", async (req, res) => {
  try {
    const pacient = await getDb().get("SELECT * FROM pacient WHERE id_pacient = ?", [req.params.id]);
    if (!pacient) return res.status(404).json({ error: "Pacient inexistent" });
    res.json(pacient);
  } catch (err) {
    console.error("Eroare la preluarea pacientului:", err.message);
    res.status(500).json({ error: "Eroare server" });
  }
});

// Istoric programări
app.get('/api/programari/:id', async (req, res) => {
  try {
    const rows = await getDb().all(`
      SELECT p.data, p.ora, p.status, m.nume AS medic, m.specializare
      FROM programare p
      JOIN medic m ON p.id_medic = m.id_medic
      WHERE p.id_pacient = ?
      ORDER BY p.data DESC, p.ora DESC
    `, [req.params.id]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Eroare la încărcarea programărilor' });
  }
});

// Salvare programare
app.post('/api/programari', async (req, res) => {
  const { id_pacient, id_medic, data, ora, detalii } = req.body;
  try {
    await getDb().run(`
      INSERT INTO programare (id_pacient, id_medic, data, ora, status)
      VALUES (?, ?, ?, ?, 'programata')
    `, [id_pacient, id_medic, data, ora]);
    res.status(201).json({ message: 'Programare înregistrată cu succes' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Eroare la salvarea programării' });
  }
});

// Specializări distincte
app.get('/api/specializari', async (req, res) => {
  try {
    const rows = await getDb().all(`SELECT DISTINCT specializare FROM medic`);
    const specializari = rows.map(r => r.specializare);
    res.json(specializari);
  } catch (err) {
    console.error("❌ Eroare la extragerea specializărilor:", err);
    res.status(500).json({ message: "Eroare server la extragerea specializărilor" });
  }
});

/* Pornire server
startDatabase().then((connected) => {
  if (!connected) {
    console.log("Serverul se oprește");
    process.exit(1);
  }
  db = getDb();
  app.listen(3000, '0.0.0.0', () => {
    console.log("Serverul rulează pe http://localhost:3000");
  });
});*/

// Pornire server
startDatabase().then((connected) => {
  if (!connected) {
    console.log("Serverul se oprește");
    process.exit(1);
  }
  db = getDb();
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Serverul rulează pe portul ${PORT}`);
  });
});

