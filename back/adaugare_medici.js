const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("clinica.db");

const medici = [
  { nume: "Marin Doru", specializare: "Stomatologie generală", email: "doru@ace.clinic.ro", telefon: "0722000010", parola: "parola123" },
{ nume: "Zamfir Anca", specializare: "Stomatologie generală", email: "anca.zamfir@ace.clinic.ro", telefon: "0722000021", parola: "parola123" },
{ nume: "Voinea Bogdan", specializare: "Stomatologie generală", email: "bogdan.voinea@ace.clinic.ro", telefon: "0722000022", parola: "parola123" },
{ nume: "Radu Mihai", specializare: "Ortodonție", email: "radu@ace.clinic.ro", telefon: "0722000002", parola: "parola123" },
{ nume: "Georgescu Irina", specializare: "Ortodonție", email: "irina.georgescu@ace.clinic.ro", telefon: "0722000023", parola: "parola123" },
{ nume: "Barbu Adrian", specializare: "Ortodonție", email: "adrian.barbu@ace.clinic.ro", telefon: "0722000024", parola: "parola123" },
{ nume: "Ghiță Iulian", specializare: "Protetică dentară", email: "ghita@ace.clinic.ro", telefon: "0722000003", parola: "parola123" },
{ nume: "Mihăilescu Simona", specializare: "Protetică dentară", email: "simona.miha@ace.clinic.ro", telefon: "0722000025", parola: "parola123" },
{ nume: "Cristea Vlad", specializare: "Protetică dentară", email: "vlad.cristea@ace.clinic.ro", telefon: "0722000026", parola: "parola123" },
{ nume: "Drăgan Sorin", specializare: "Chirurgie dento-alveolară", email: "sorin@ace.clinic.ro", telefon: "0722000005", parola: "parola123" },
{ nume: "Tănase Maria", specializare: "Chirurgie dento-alveolară", email: "maria.tanase@ace.clinic.ro", telefon: "0722000027", parola: "parola123" },
{ nume: "Cojocaru Ion", specializare: "Chirurgie dento-alveolară", email: "ion.cojocaru@ace.clinic.ro", telefon: "0722000028", parola: "parola123" },
{ nume: "Ionescu Mirela", specializare: "Endodonție", email: "mirela@ace.clinic.ro", telefon: "0722000006", parola: "parola123" },
{ nume: "Petrescu Alex", specializare: "Endodonție", email: "alex.petrescu@ace.clinic.ro", telefon: "0722000029", parola: "parola123" },
{ nume: "Banu Florina", specializare: "Endodonție", email: "florina.banu@ace.clinic.ro", telefon: "0722000030", parola: "parola123" },
{ nume: "Constantinescu Vlad", specializare: "Parodontologie", email: "vlad@ace.clinic.ro", telefon: "0722000007", parola: "parola123" },
{ nume: "Savulescu Anca", specializare: "Parodontologie", email: "anca.savulescu@ace.clinic.ro", telefon: "0722000031", parola: "parola123" },
{ nume: "Ilie Dorin", specializare: "Parodontologie", email: "dorin.ilie@ace.clinic.ro", telefon: "0722000032", parola: "parola123" },
{ nume: "Enache Paula", specializare: "Radiologie dentară", email: "paula@ace.clinic.ro", telefon: "0722000008", parola: "parola123" },
{ nume: "Chivu Marius", specializare: "Radiologie dentară", email: "marius.chivu@ace.clinic.ro", telefon: "0722000033", parola: "parola123" },
{ nume: "Rosu Bianca", specializare: "Radiologie dentară", email: "bianca.rosu@ace.clinic.ro", telefon: "0722000034", parola: "parola123" },
{ nume: "Voicu Ana", specializare: "Estetică dentară", email: "ana@ace.clinic.ro", telefon: "0722000009", parola: "parola123" },
{ nume: "Marinescu Teodora", specializare: "Estetică dentară", email: "teodora.marinescu@ace.clinic.ro", telefon: "0722000035", parola: "parola123" },
{ nume: "Pavel Iulia", specializare: "Estetică dentară", email: "iulia.pavel@ace.clinic.ro", telefon: "0722000036", parola: "parola123" },
{ nume: "Popa Elena", specializare: "Primiri urgențe dentare", email: "elena@ace.clinic.ro", telefon: "0722000004", parola: "parola123" },
{ nume: "Matei Ruxandra", specializare: "Primiri urgențe dentare", email: "ruxandra.matei@ace.clinic.ro", telefon: "0722000037", parola: "parola123" },
{ nume: "Grigore Andrei", specializare: "Primiri urgențe dentare", email: "andrei.grigore@ace.clinic.ro", telefon: "0722000038", parola: "parola123" }

];
let procesate = 0;

db.serialize(() => {
  medici.forEach((medic) => {
    db.get(
      `SELECT * FROM medic WHERE email = ?`,
      [medic.email],
      (err, row) => {
        if (err) {
          console.error("Eroare la verificare:", err.message);
          finalizare();
        } else if (!row) {
          db.run(
            `INSERT INTO medic (nume, specializare, email, telefon, parola)
             VALUES (?, ?, ?, ?, ?)`,
            [medic.nume, medic.specializare, medic.email, medic.telefon, medic.parola],
            (insertErr) => {
              if (insertErr) {
                console.error("Eroare la inserare:", insertErr.message);
              } else {
                console.log(`Medic adăugat: ${medic.nume}`);
              }
              finalizare();
            }
          );
        } else {
          console.log(`Medic deja există: ${medic.email}`);
          finalizare();
        }
      }
    );
  });
});

function finalizare() {
  procesate++;
  if (procesate === medici.length) {
    db.close();
    console.log("Popularea bazei de date s-a încheiat.");
  }
}
