const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const fs = require('fs');
const path = require('path');

let db = null;

const startDatabase = async () => {
  try {
    db = await open({
      filename: './clinica.db',
      driver: sqlite3.Database
    });

    const queries = fs.readFileSync(path.join(__dirname, 'queries.sql'), 'utf8');
    await db.exec(queries);

    console.log('Baza de date a fost initializata cu succes');
    return true;
  } catch (error) {
    console.log('Eroare în stabilirea conexiunii cu baza de date: ' + error.message);
    return false;
  }
};

const getDb = () => db;

// Funcție de test/debug pentru afișare rapidă date DB (fost test_consultatii.js)
async function testDatabaseInfo() {
  try {
    if (!db) await startDatabase();
    console.log('=== TEST CONSULTATII ===');
    const allConsultatii = await db.all('SELECT * FROM consultatie');
    console.log('Toate consultațiile:', allConsultatii.length);
    if (allConsultatii.length > 0) {
      console.log('Prima consultație:', allConsultatii[0]);
    }
    const medicSchema = await db.all("PRAGMA table_info(medic)");
    console.log('Structura tabela medic:', medicSchema);
    const medici = await db.all('SELECT * FROM medic');
    console.log('Medici în baza de date:', medici.length);
    if (medici.length > 0) {
      console.log('Primul medic:', medici[0]);
    }
    const pacientId = 1;
    const consultatiiPacient = await db.all(`
      SELECT 
        c.*,
        m.nume as nume_medic,
        m.specializare
      FROM consultatie c
      JOIN medic m ON c.id_medic = m.id_medic
      WHERE c.id_pacient = ?
    `, [pacientId]);
    console.log(`Consultații pentru pacientul ${pacientId}:`, consultatiiPacient.length);
    if (consultatiiPacient.length > 0) {
      console.log('Prima consultație a pacientului:', consultatiiPacient[0]);
    }
  } catch (err) {
    console.error('Eroare testDatabaseInfo:', err);
  }
}

module.exports = { startDatabase, getDb, testDatabaseInfo };
