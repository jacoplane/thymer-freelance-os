export function choiceLabel(config, property, value) {
    const raw = Array.isArray(value) ? value[1] : value;
    return config.fields.find(field => field.label === property)?.choices?.find(choice => choice.id === raw)?.label || raw || '';
}

export function planClientLifecycleMigration(records, config) {
    if (!config.fields.some(field => field.label === 'lead_stage' && field.active !== false)) return [];
    return records.flatMap(record => {
        if (/^New Client Template$/i.test(record.name || '')) return [];
        const status = choiceLabel(config, 'status', record.properties?.status);
        const stage = choiceLabel(config, 'lead_stage', record.properties?.lead_stage);
        if (!['prospect', 'lead'].includes(status)) return [];
        const next = ['contacted', 'discussing', 'proposal_sent'].includes(stage) ? stage : status === 'lead' ? 'prospect' : status;
        return next === status ? [] : [{ guid: record.guid, from: status, to: next, stage }];
    });
}
