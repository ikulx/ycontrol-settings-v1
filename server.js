const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Absoluter Pfad zur SQLite-Datenbank
const dbPath = path.resolve(__dirname, 'mnt/data/ycontroldata_settings.db');
const ADMIN_PASSWORD = 'Ygnis@6017';  // Setzen Sie hier Ihr Passwort

// Verbindung zur SQLite-Datenbank herstellen
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error(`Error opening database: ${err.message}`);
    } else {
        console.log('Connected to the SQLite database.');
    }
});

// Middleware für das Parsen von JSON-Daten und Sitzungen
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true
}));

// Statische Dateien aus dem "public" Ordner bereitstellen
app.use(express.static(path.join(__dirname, 'public')));

// Middleware zur Überprüfung der Authentifizierung
function checkAuth(req, res, next) {
    if (req.session && req.session.authenticated) {
        return next();
    } else {
        res.redirect('/login');
    }
}

// Route für die Login-Seite
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Route für die Login-Authentifizierung
app.post('/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        req.session.authenticated = true;
        res.redirect('/admin');
    } else {
        res.status(401).json({ error: 'incorrect' });
    }
});

// Route für die Admin-Seite
app.get('/admin', checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '', 'admin.html'));
});

// Route für das Abrufen aller Einträge
app.get('/api/all', checkAuth, (req, res) => {
    let sortColumn = req.query.sortColumn || 'sort';
    let sortOrder = req.query.sortOrder || 'asc';
    const validColumns = ['NAME', 'VAR_VALUE', 'unit', 'TYPE', 'OPTI', 'MIN', 'MAX', 'EDITOR', 'visible', 'sort', 'adresse', 'faktor', 'HKL', 'HKL_Feld'];

    if (!validColumns.includes(sortColumn)) {
        sortColumn = 'sort';
    }
    if (sortOrder !== 'asc' && sortOrder !== 'desc') {
        sortOrder = 'asc';
    }

    const query = `SELECT id, NAME, VAR_VALUE, TYPE, EDITOR, OPTI, MIN, MAX, visible, sort, unit, adresse, faktor, HKL, HKL_Feld FROM QHMI_VARIABLES ORDER BY ${sortColumn} ${sortOrder}`;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error(`Error executing query: ${err.message}`);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Route für das Hinzufügen eines neuen Eintrags
app.post('/api/add', checkAuth, (req, res) => {
    const { NAME, VAR_VALUE, TYPE, EDITOR, OPTI, MIN, MAX, sort, unit, adresse, faktor, HKL, HKL_Feld } = req.body;
    const query = `INSERT INTO QHMI_VARIABLES (NAME, VAR_VALUE, TYPE, EDITOR, OPTI, MIN, MAX, visible, sort, unit, adresse, faktor, HKL, HKL_Feld) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`;
    db.run(query, [NAME, VAR_VALUE, TYPE, EDITOR, OPTI, MIN, MAX, sort, unit, adresse, faktor, HKL, HKL_Feld], function(err) {
        if (err) {
            console.error(`Error adding data: ${err.message}`);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Data added successfully' });
    });
});

// Route für das Aktualisieren eines Eintrags
app.post('/api/update', (req, res) => {
    const { id, VAR_VALUE, HKL, HKL_Feld } = req.body;
    const query = "UPDATE QHMI_VARIABLES SET VAR_VALUE = ? WHERE id = ?";
    db.run(query, [VAR_VALUE, id], function(err) {
        if (err) {
            console.error(`Error updating data: ${err.message}`);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Data updated successfully' });
    });
});

// Route für das Aktualisieren mehrerer Einträge
app.post('/api/admin/update', (req, res) => {
    const updates = req.body;
    console.log('Received updates:', updates);
    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        updates.forEach(update => {
            const { id, VAR_VALUE, visible, NAME, TYPE, OPTI, MIN, MAX, EDITOR, sort, unit, adresse, faktor, HKL, HKL_Feld } = update;
            const query = `UPDATE QHMI_VARIABLES SET VAR_VALUE = ?, visible = ?, NAME = ?, TYPE = ?, OPTI = ?, MIN = ?, MAX = ?, EDITOR = ?, sort = ?, unit = ?, adresse = ?, faktor = ?, HKL = ?, HKL_Feld = ? WHERE id = ?`;
            db.run(query, [VAR_VALUE, visible, NAME, TYPE, OPTI, MIN, MAX, EDITOR, sort, unit, adresse, faktor, HKL, HKL_Feld, id], function(err) {
                if (err) {
                    console.error(`Error updating data: ${err.message}`);
                    db.run("ROLLBACK");
                    res.status(500).json({ error: err.message });
                    return;
                }
            });
        });
        db.run("COMMIT", (err) => {
            if (err) {
                console.error(`Error committing transaction: ${err.message}`);
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ message: 'All data updated successfully' });
        });
    });
});

// Route für das Löschen eines Eintrags
app.post('/api/delete', checkAuth, (req, res) => {
    const { id } = req.body;
    const query = "DELETE FROM QHMI_VARIABLES WHERE id = ?";
    db.run(query, [id], function(err) {
        if (err) {
            console.error(`Error deleting data: ${err.message}`);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Data deleted successfully' });
    });
});

// Route für das Abrufen der einzigartigen EDITOR-Werte
app.get('/api/editors', (req, res) => {
    const query = "SELECT DISTINCT EDITOR FROM QHMI_VARIABLES";
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error(`Error executing query: ${err.message}`);
            res.status(500).json({ error: err.message });
            return;
        }
        const editors = rows.map(row => row.EDITOR).flat();
        res.json(editors);
    });
});

// Dynamische Seiten generieren
app.get('/editor/:editor', (req, res) => {
    const editor = req.params.editor;
    const templatePath = path.join(__dirname, 'public', 'editor_template.html');
    fs.readFile(templatePath, 'utf8', (err, data) => {
        if (err) {
            console.error(`Error reading template: ${err.message}`);
            res.status(500).send('Internal Server Error');
            return;
        }
        const pageContent = data.replace(/{{EDITOR}}/g, editor);
        res.send(pageContent);
    });
});

// Route für das Abrufen der Daten basierend auf dem EDITOR-Wert
app.get('/api/data/:editor', (req, res) => {
    const editor = req.params.editor;
    const query = "SELECT id, NAME, VAR_VALUE, TYPE, OPTI, MIN, MAX, sort, unit, adresse, faktor, HKL, HKL_Feld FROM QHMI_VARIABLES WHERE EDITOR LIKE ? AND visible = 1 ORDER BY sort ASC";
    db.all(query, [`%${editor}%`], (err, rows) => {
        if (err) {
            console.error(`Error executing query: ${err.message}`);
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Route für die Indexseite
app.get('/', (req, res) => {
    const templatePath = path.join(__dirname, 'public', 'index.html');
    fs.readFile(templatePath, 'utf8', (err, data) => {
        if (err) {
            console.error(`Error reading template: ${err.message}`);
            res.status(500).send('Internal Server Error');
            return;
        }
        res.send(data);
    });
});

// Server starten
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
