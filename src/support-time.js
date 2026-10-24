function summarizeSupportTime(clients, records, today = new Date()) {
    const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const clientMap = new Map(clients.map(client => [client.guid, client]));
    const allowance = clients.filter(client => ['active', 'maintenance'].includes(client.status))
        .reduce((sum, client) => sum + Math.max(0, Number(client.includedHours) || 0), 0);
    const sessions = records.map(record => {
        const date = String(getProp(record, 'date') || '').slice(0, 10);
        const hours = Number(getProp(record, 'hours')) || 0;
        const clientGuid = getClientGuid(record);
        const client = clientMap.get(clientGuid);
        return {
            guid: record.guid,
            title: record.getName?.() || record.name || 'Support session',
            date,
            hours,
            description: getProp(record, 'description'),
            clientGuid,
            clientName: client?.name || '',
            month: date.slice(0, 7)
        };
    }).filter(session => session.month === month && session.hours > 0 && /^\d{4}-\d{2}-\d{2}$/.test(session.date))
        .sort((a, b) => b.date.localeCompare(a.date) || b.title.localeCompare(a.title));
    const byClient = new Map();
    for (const session of sessions) byClient.set(session.clientGuid, (byClient.get(session.clientGuid) || 0) + session.hours);
    return {
        month,
        hours: sessions.reduce((sum, session) => sum + session.hours, 0),
        allowance,
        clients: clients.filter(client => ['active', 'maintenance'].includes(client.status) && client.includedHours > 0)
            .map(client => ({ ...client, logged: byClient.get(client.guid) || 0 })),
        sessions
    };
}
