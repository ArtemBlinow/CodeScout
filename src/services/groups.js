const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { log } = require('./logger');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'accounts.db');
const db = new sqlite3.Database(DB_PATH);

db.run(`
    CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        created_by TEXT NOT NULL REFERENCES accounts(login),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

db.run(`
    CREATE TABLE IF NOT EXISTS group_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        handle TEXT NOT NULL,
        org_name TEXT DEFAULT '',
        team_name TEXT DEFAULT ''
    )
`);

function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function getQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function allQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

async function getGroupsByOwner(login) {
    return allQuery('SELECT * FROM groups WHERE created_by = ? ORDER BY created_at DESC', [login]);
}

async function createGroup(name, description, createdBy) {
    const result = await runQuery(
        'INSERT INTO groups (name, description, created_by) VALUES (?, ?, ?)',
        [name, description || '', createdBy]
    );
    log('users', `Группа создана: "${name}" by ${createdBy}`);
    return result.lastID;
}

async function updateGroup(id, name, description) {
    await runQuery(
        'UPDATE groups SET name = ?, description = ? WHERE id = ?',
        [name, description || '', id]
    );
    log('users', `Группа обновлена: id=${id}`);
}

async function deleteGroup(id) {
    await runQuery('DELETE FROM groups WHERE id = ?', [id]);
    log('users', `Группа удалена: id=${id}`);
}

async function getGroupMembers(groupId) {
    return allQuery('SELECT * FROM group_members WHERE group_id = ? ORDER BY org_name, team_name, handle', [groupId]);
}

async function setGroupMembers(groupId, members) {
    await runQuery('DELETE FROM group_members WHERE group_id = ?', [groupId]);
    for (const m of members) {
        await runQuery(
            'INSERT INTO group_members (group_id, handle, org_name, team_name) VALUES (?, ?, ?, ?)',
            [groupId, m.handle, m.org_name || '', m.team_name || '']
        );
    }
    log('users', `Участники группы id=${groupId} обновлены: ${members.length} шт.`);
}

async function getGroupById(id) {
    return getQuery('SELECT * FROM groups WHERE id = ?', [id]);
}

async function isOwner(groupId, login) {
    const row = await getQuery('SELECT 1 FROM groups WHERE id = ? AND created_by = ?', [groupId, login]);
    return !!row;
}

module.exports = {
    getGroupsByOwner,
    createGroup,
    updateGroup,
    deleteGroup,
    getGroupMembers,
    setGroupMembers,
    getGroupById,
    isOwner
};
