const INVOICE_STAGES = { draft: 'Draft', ready: 'Ready to send', sent: 'Sent' };
const INVOICE_PAYMENTS = { unpaid: 'Unpaid', unconfirmed: 'To confirm', paid: 'Paid' };
const BILLING_FILTERS = [['all', 'All'], ['to-send', 'To send'], ['outstanding', 'Outstanding'], ['overdue', 'Overdue'], ['review', 'To confirm'], ['paid', 'Paid']];

function billingNextAction(invoice) {
    if (invoice.status === 'paid') return null;
    if (invoice.stage === 'draft') return { action: 'ready', label: 'Ready to send' };
    if (invoice.stage === 'ready') return { action: 'sent', label: 'Mark sent' };
    if (invoice.stage === 'sent' && !invoice.issuedDate) return { action: 'sent', label: 'Add issue date' };
    if (invoice.stage === 'sent' && ['unpaid', 'unconfirmed'].includes(invoice.status)) return { action: 'paid', label: invoice.status === 'unconfirmed' ? 'Confirm payment' : 'Record payment' };
    return null;
}

function billingInvoices(invoices, filter, search = '') {
    const query = search.trim().toLowerCase();
    return invoices.filter(invoice => invoiceMatches(invoice, filter) && (!query || [invoice.invoiceId, invoice.name, invoice.clientName, invoice.currency].filter(Boolean).join(' ').toLowerCase().includes(query)));
}

function billingSummary(invoices) {
    return { ...summarizeInvoices(invoices), overdueCount: invoices.filter(invoice => invoiceMatches(invoice, 'overdue')).length, unconfirmedCount: invoices.filter(invoice => invoiceMatches(invoice, 'review')).length };
}

const Billing = {
    async updateInvoiceState(invoice, action, date = '') {
        if (!['ready', 'sent', 'paid'].includes(action)) throw new Error('Choose an available invoice action.');
        if (!Number.isFinite(invoice.amount) || invoice.amount <= 0 || !invoice.currency) throw new Error('Check the invoice amount and currency before changing its state.');
        if (action === 'ready' && (invoice.stage !== 'draft' || invoice.status === 'paid')) throw new Error('Only an unpaid draft can be marked ready.');
        if (action === 'sent' && (!['ready', 'sent'].includes(invoice.stage) || (invoice.stage === 'sent' && invoice.issuedDate) || invoice.status === 'paid')) throw new Error('Mark a ready invoice sent, or record a missing issue date on a sent invoice.');
        if (action === 'paid' && (invoice.stage !== 'sent' || !['unpaid', 'unconfirmed'].includes(invoice.status))) throw new Error('Record payment on a sent, unpaid invoice.');
        if (action !== 'ready' && (dateDay(date) === null || date > localDate())) throw new Error('Choose a valid date no later than today.');
        this.billingWrites ||= new Set();
        if (this.billingWrites.has(invoice.guid)) throw new Error('This invoice is already being saved.');
        this.billingWrites.add(invoice.guid);
        try {
            const collections = await this.data.getAllCollections();
            const collection = collections.find(item => item.getGuid() === this.collectionGuid('Invoices', collections));
            if (!collection) throw new Error('Choose your Invoices collection in Settings.');
            const record = (await collection.getAllRecords()).find(item => item.guid === invoice.guid);
            if (!record) throw new Error('This invoice could not be found. Refresh before retrying.');
            if (Number(getProp(record, 'amount_chf')) !== invoice.amount || String(getProp(record, 'currency') || 'CHF').toUpperCase() !== invoice.currency || getClientGuid(record) !== (invoice.clientGuid || '')) throw new Error('The invoice amount, currency, or client changed. Close this form and refresh before recording payment or sending.');
            const values = action === 'ready' ? { status: 'ready' } : action === 'sent' ? { issued: date, status: 'sent' } : { paid_date: date, payment_status: 'paid' };
            const previous = { status: invoice.stage, payment_status: invoice.status, issued: invoice.issuedDate || '', paid_date: invoice.paidDate || '' };
            for (const [label, old] of Object.entries(previous)) {
                const current = getProp(record, label) || (label === 'payment_status' ? 'unpaid' : '');
                if (String(current) !== String(old) && String(current) !== String(values[label] ?? old)) throw new Error('The invoice changed elsewhere. Close this form and refresh before retrying.');
            }
            const fields = collection.getConfiguration().fields;
            const writes = Object.entries(values).map(([label, value]) => {
                const field = fields.find(field => field.label === label);
                const property = record.prop(label);
                const expectedType = ['issued', 'paid_date'].includes(label) ? 'datetime' : 'choice';
                if (!field || !property || field.type !== expectedType || field.active === false || field.read_only || (field.type === 'choice' && !field.choices?.some(choice => choice.label === value && choice.active !== false))) throw new Error(`Check the Invoices.${label} field in your collection setup.`);
                return { label, value, field, property };
            });
            for (const { label, value, field, property } of writes) {
                if (getProp(record, label) === value) continue;
                let saved;
                if (field.type === 'choice') saved = property.setChoice(value);
                else if (field.type === 'datetime') { const [year, month, day] = value.split('-').map(Number); saved = property.set(DateTime.dateOnly(year, month - 1, day).value()); }
                else saved = property.set(value);
                if (saved === false) throw new Error(`${label} could not be saved. Some details may already be saved; check the invoice before retrying.`);
            }
            const verified = (await collection.getAllRecords()).find(item => item.guid === invoice.guid);
            for (const { label, value } of writes) if (!verified || getProp(verified, label) !== value) throw new Error('The invoice update could not be verified. Open it before retrying.');
        } finally { this.billingWrites.delete(invoice.guid); }
    },

    openBillingDialog(panel, { title, body, submitLabel, save }) {
        if (document.querySelector('.os-billing-dialog')) return;
        const launch = document.activeElement, focusKey = launch?.dataset.focusKey;
        let saving = false;
        const backdrop = document.createElement('div'); backdrop.className = 'os-modal-backdrop';
        backdrop.innerHTML = `<form class="os-modal-card os-billing-dialog" role="dialog" aria-modal="true" aria-labelledby="os-billing-dialog-title">
            <div class="os-modal-header"><h3 id="os-billing-dialog-title">${escapeHtml(title)}</h3><button type="button" class="os-modal-close" aria-label="Close">✕</button></div>
            <div class="os-modal-body">${body}<p class="os-billing-error" role="alert" tabindex="-1" hidden></p></div>
            <div class="os-modal-footer"><button type="button" class="os-button btn-cancel">Cancel</button><button type="submit" class="os-button os-primary btn-submit">${escapeHtml(submitLabel)}</button></div></form>`;
        const form = backdrop.querySelector('form'), submit = form.querySelector('.btn-submit'), error = form.querySelector('.os-billing-error');
        const close = () => { if (saving) return; backdrop.remove(); if (launch?.isConnected) launch.focus(); this.flushRefresh(); };
        form.querySelector('.os-modal-close').onclick = close; form.querySelector('.btn-cancel').onclick = close;
        backdrop.onclick = event => { if (event.target === backdrop) close(); };
        form.onkeydown = event => {
            if (event.key === 'Escape') { event.preventDefault(); close(); }
            if (event.key === 'Tab') {
                const controls = [...form.querySelectorAll('button, input, select')].filter(e => !e.disabled && e.getClientRects().length);
                if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1).focus(); }
                else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus(); }
            }
        };
        form.onsubmit = async event => {
            event.preventDefault(); if (saving || !form.reportValidity()) return;
            saving = true; submit.disabled = true; submit.textContent = 'Saving…'; error.hidden = true; form.setAttribute('aria-busy', 'true');
            try {
                await save(form);
                saving = false; close();
                await this.render(panel);
                const replacement = [...document.querySelectorAll('[data-focus-key]')].find(e => e.dataset.focusKey === focusKey) || document.querySelector('.os-billing-search');
                replacement?.focus({ preventScroll: true });
            } catch (failure) {
                saving = false; submit.disabled = false; submit.textContent = submitLabel; form.removeAttribute('aria-busy');
                error.textContent = failure.message || 'The invoice could not be saved. Your entries are still here.'; error.hidden = false; error.focus();
            }
        };
        document.body.appendChild(backdrop);
        form.querySelector('input, select')?.focus();
        return form;
    },

    showBillingStateModal(invoice, action, panel) {
        const payment = action === 'paid';
        const missingDate = !payment && invoice.stage === 'sent';
        this.openBillingDialog(panel, {
            title: payment ? 'Record full payment' : missingDate ? 'Record issue date' : 'Mark invoice sent', submitLabel: payment ? 'Confirm full payment' : missingDate ? 'Save issue date' : 'Mark sent',
            body: `<div class="os-billing-confirm-summary"><strong>${escapeHtml(invoice.invoiceId || invoice.name)}</strong><span>${escapeHtml(invoice.clientName || 'No client linked')}</span><span>${money(invoice.amount)} ${escapeHtml(invoice.currency)}</span></div>
                <p class="os-form-help">${payment ? 'Record this after verifying that the full invoice amount was received.' : missingDate ? 'This invoice is marked sent. Record its issue date.' : 'Update the register after sending this invoice.'}</p>
                <div class="os-form-group"><label for="os-billing-action-date">${payment ? 'Payment received on' : 'Issue date'}</label><input id="os-billing-action-date" class="os-input input-date" type="date" value="${escapeHtml(payment ? localDate() : invoice.issuedDate || localDate())}" max="${localDate()}" required /></div>`,
            save: async form => {
                await this.updateInvoiceState(invoice, action, form.querySelector('.input-date').value);
                this.billingMessage = `${invoice.invoiceId || invoice.name}: ${payment ? 'full payment recorded' : missingDate ? 'issue date recorded' : 'marked sent'}.`;
            }
        });
    },

    showBillingInvoiceModal(panel, data) {
        const clients = data.clients;
        const currencies = data.invoiceCurrencies || ['CHF', 'EUR', 'USD'];
        const form = this.openBillingDialog(panel, {
            title: 'Add invoice', submitLabel: 'Add invoice',
            body: `<div class="os-billing-form-grid">
                <div class="os-form-group"><label for="os-invoice-ref">Invoice reference *</label><input id="os-invoice-ref" class="os-input input-title" placeholder="e.g. INV-2026-014" required /></div>
                <div class="os-form-group"><label for="os-invoice-client">Client *</label><select id="os-invoice-client" class="os-select input-client" required><option value="">Choose a client…</option>${clients.map(client => `<option value="${client.guid}">${escapeHtml(client.name)}</option>`).join('')}</select></div>
                <div class="os-form-group"><label for="os-invoice-amount">Amount *</label><input id="os-invoice-amount" class="os-input input-amount" type="number" min="0.01" step="0.01" required /></div>
                <div class="os-form-group"><label for="os-invoice-currency">Currency</label><select id="os-invoice-currency" class="os-select input-currency" required>${currencies.map(currency => `<option ${currency === 'CHF' ? 'selected' : ''}>${escapeHtml(currency)}</option>`).join('')}</select></div>
                <div class="os-form-group"><label for="os-invoice-stage">Sending stage</label><select id="os-invoice-stage" class="os-select input-stage">${Object.entries(INVOICE_STAGES).map(([key, value]) => `<option value="${key}">${value}</option>`).join('')}</select></div>
                <div class="os-form-group"><label for="os-invoice-payment">Payment state</label><select id="os-invoice-payment" class="os-select input-status">${Object.entries(INVOICE_PAYMENTS).map(([key, value]) => `<option value="${key}">${value}</option>`).join('')}</select></div>
                <div class="os-form-group"><label for="os-invoice-issued">Issue date</label><input id="os-invoice-issued" class="os-input input-issued" type="date" max="${localDate()}" /></div>
                <div class="os-form-group"><label for="os-invoice-due">Due date</label><input id="os-invoice-due" class="os-input input-due" type="date" /></div>
                <div class="os-form-group os-invoice-paid-field" hidden><label for="os-invoice-paid">Payment received on</label><input id="os-invoice-paid" class="os-input input-paid-date" type="date" max="${localDate()}" /></div>
                </div><p class="os-form-help">Records an invoice in Thymer. Keep its PDF and payment evidence on the native invoice page.</p>`,
            save: async form => {
                const title = form.querySelector('.input-title').value.trim(), stage = form.querySelector('.input-stage').value, payment = form.querySelector('.input-status').value;
                const issued = form.querySelector('.input-issued').value, paid = form.querySelector('.input-paid-date').value;
                if (stage === 'sent' && !issued) throw new Error('Choose the issue date for a sent invoice.');
                if (payment === 'paid' && (stage !== 'sent' || !issued || !paid)) throw new Error('A paid invoice needs Sent stage, an issue date, and its payment date.');
                await this.createConfiguredRecord('Invoices', title, { invoice_id: title, amount_chf: Number(form.querySelector('.input-amount').value), currency: form.querySelector('.input-currency').value, client: form.querySelector('.input-client').value, status: stage, payment_status: payment, issued, due: form.querySelector('.input-due').value, ...(payment === 'paid' ? { paid_date: paid } : {}) });
                this.workflowMode = 'billing'; this.billingTab = 'invoices'; this.billingSearch = ''; this.invoiceFilter = payment === 'paid' ? 'paid' : stage === 'sent' ? 'outstanding' : 'to-send';
                this.billingMessage = `${title} added to the invoice register.`;
            }
        });
        if (!form) return;
        form.querySelector('.input-stage').onchange = () => { form.querySelector('.input-issued').required = form.querySelector('.input-stage').value === 'sent'; };
        form.querySelector('.input-status').onchange = () => {
            const paid = form.querySelector('.input-status').value === 'paid';
            form.querySelector('.os-invoice-paid-field').hidden = !paid;
            form.querySelector('.input-paid-date').required = paid;
        };
    },

    renderBilling(data, panel) {
        const section = document.createElement('section'); section.className = 'os-billing';
        if (data.loadError) {
            section.innerHTML = '<h2>Billing unavailable</h2><p role="alert">Invoice or client records could not be loaded. Check the collection mappings and retry.</p><button class="os-button">Retry</button>';
            section.querySelector('button').onclick = () => this.render(panel); return section;
        }
        const plans = data.clients.filter(client => client.status === 'maintenance' || (isRevenueClient(client) && client.mrr > 0));
        const cash = billingSummary(data.invoices);
        section.innerHTML = `<div class="os-billing-heading"><div><h2>Billing</h2><p>Invoices and maintenance plans</p></div><div class="os-billing-heading-actions"><button class="os-card-open os-billing-register">Native register ↗</button><button class="os-button os-primary os-billing-add">Add invoice</button></div></div>
            <dl class="os-billing-summary"><div><dt>Outstanding</dt><dd>${money(cash.outstanding)} <span>CHF</span></dd></div><div><dt>Overdue · ${cash.overdueCount}</dt><dd>${money(cash.overdue)} <span>CHF</span></dd></div><div><dt>To confirm</dt><dd>${cash.unconfirmedCount} <span>invoice${cash.unconfirmedCount === 1 ? '' : 's'}</span></dd></div><div><dt>To send</dt><dd>${cash.toSend} <span>invoice${cash.toSend === 1 ? '' : 's'}</span></dd></div></dl>
            <p class="os-billing-currency-note">Amounts use CHF invoices; counts cover all currencies.${cash.excludedCurrency ? ` ${cash.excludedCurrency} other-currency invoice${cash.excludedCurrency === 1 ? ' is' : 's are'} shown without conversion.` : ''}</p>
            <p class="os-billing-message" role="status" ${this.billingMessage ? '' : 'hidden'}>${escapeHtml(this.billingMessage || '')}</p>
            <div class="os-billing-toolbar"><div class="os-tabs"><button class="os-tab ${this.billingTab !== 'plans' ? 'active' : ''}" data-billing-tab="invoices" data-focus-key="billing-tab-invoices">Invoices (${data.invoices.length})</button><button class="os-tab ${this.billingTab === 'plans' ? 'active' : ''}" data-billing-tab="plans" data-focus-key="billing-tab-plans">Maintenance plans (${plans.length})</button></div><input class="os-search-input os-billing-search" data-focus-key="billing-search" aria-label="Search ${this.billingTab === 'plans' ? 'maintenance plans' : 'invoices'}" placeholder="Search ${this.billingTab === 'plans' ? 'clients or services' : 'reference or client'}…" value="${escapeHtml(this.billingSearch || '')}" /></div>
            <div class="os-billing-filters os-filter-pills" aria-label="Filter invoices" ${this.billingTab === 'plans' ? 'hidden' : ''}></div><div class="os-billing-results"></div>`;
        section.querySelector('.os-billing-add').onclick = () => this.showCreateInvoiceModal(panel, data);
        section.querySelector('.os-billing-register').onclick = () => this.openCollection(this.collectionGuid(this.billingTab === 'plans' ? 'Clients' : 'Invoices'), panel, this.billingTab === 'plans' ? 'care-plans' : this.invoiceFilter);
        section.querySelectorAll('[data-billing-tab]').forEach(button => { button.setAttribute('aria-pressed', String(button.classList.contains('active'))); button.onclick = () => { this.billingTab = button.dataset.billingTab; this.billingSearch = ''; this.render(panel); }; });
        const filters = section.querySelector('.os-billing-filters');
        for (const [key, label] of BILLING_FILTERS) {
            const button = document.createElement('button'); button.type = 'button'; button.className = `os-filter-pill ${this.invoiceFilter === key ? 'active' : ''}`; button.dataset.billingFilter = key; button.dataset.focusKey = `billing-filter-${key}`;
            button.setAttribute('aria-pressed', String(this.invoiceFilter === key)); button.textContent = `${label} (${data.invoices.filter(invoice => invoiceMatches(invoice, key)).length})`;
            button.onclick = () => { this.invoiceFilter = key; this.render(panel); }; filters.appendChild(button);
        }
        const results = section.querySelector('.os-billing-results');
        const draw = () => {
            const invoices = billingInvoices(data.invoices, this.invoiceFilter, this.billingSearch || '');
            const rows = this.billingTab === 'plans' ? plans.filter(client => clientSearchText(client).includes((this.billingSearch || '').toLowerCase())) : invoices;
            results.replaceChildren();
            if (!rows.length) {
                const empty = document.createElement('p'); empty.className = 'os-empty-placeholder'; empty.textContent = this.billingSearch ? 'No matches. Try another reference or client name.' : this.billingTab === 'plans' ? 'No maintenance plans recorded. Set a client’s status to On maintenance or record an active client’s monthly care-plan amount.' : 'No invoices in this view. Choose another filter or add an invoice.'; results.appendChild(empty); return;
            }
            const wrap = document.createElement('div'); wrap.className = 'os-billing-table-wrap'; wrap.tabIndex = 0; wrap.setAttribute('aria-label', this.billingTab === 'plans' ? 'Maintenance plan register' : 'Invoice register');
            const table = document.createElement('table'); table.className = 'os-billing-table';
            if (this.billingTab === 'plans') {
                table.innerHTML = `<caption class="os-billing-caption">Agreed plan references. Monthly amounts are normalized CHF values; no future charges are inferred.</caption><thead><tr><th scope="col">Client</th><th scope="col">Service</th><th scope="col">Monthly reference</th><th scope="col">Billing cycle</th><th scope="col">Included hours / mo</th></tr></thead><tbody>${rows.map(client => `<tr data-client="${client.guid}"><th scope="row"><button class="os-billing-client os-card-open">${escapeHtml(client.name)}</button></th><td>${escapeHtml(client.planValue || 'Not set')}</td><td class="os-billing-number">${money(client.mrr)} CHF</td><td>${escapeHtml(client.billingCycle || 'Not set')}</td><td class="os-billing-number">${client.includedHours || 0} h</td></tr>`).join('')}</tbody>`;
                table.querySelectorAll('.os-billing-client').forEach(button => { button.onclick = () => this.openRecord(button.closest('tr').dataset.client, panel); });
            } else {
                table.innerHTML = `<caption class="os-billing-caption">${rows.length} invoice${rows.length === 1 ? '' : 's'} · Sending and payment are recorded separately.</caption><thead><tr><th scope="col">Invoice</th><th scope="col">Client</th><th scope="col">Amount</th><th scope="col">Due</th><th scope="col">Sending</th><th scope="col">Payment</th><th scope="col">Action</th></tr></thead><tbody>${rows.map(invoice => {
                    const action = billingNextAction(invoice);
                    return `<tr data-invoice="${invoice.guid}"><th scope="row"><button class="os-card-open os-billing-invoice" data-focus-key="invoice-${invoice.guid}">${escapeHtml(invoice.invoiceId || invoice.name)}</button>${invoice.issuedDate ? `<span class="os-billing-detail">Issued ${escapeHtml(invoice.issuedDate)}</span>` : ''}</th><td>${invoice.clientGuid ? `<button class="os-card-open os-billing-client">${escapeHtml(invoice.clientName || 'Open client')}</button>` : 'No client linked'}</td><td class="os-billing-number">${money(invoice.amount)} ${escapeHtml(invoice.currency)}</td><td class="${invoice.daysOverdue ? 'os-billing-overdue' : ''}">${escapeHtml(invoice.dueDate || 'No due date')}${invoice.daysOverdue ? `<span class="os-billing-detail">${invoice.daysOverdue}d overdue</span>` : ''}</td><td>${escapeHtml(INVOICE_STAGES[invoice.stage] || 'Unknown')}</td><td>${escapeHtml(INVOICE_PAYMENTS[invoice.status] || 'Unknown')}${invoice.status === 'paid' ? `<span class="os-billing-detail">${escapeHtml(invoice.paidDate || 'Date not recorded')}</span>` : ''}</td><td>${action ? `<button class="os-button os-billing-row-action" data-action="${action.action}" data-focus-key="invoice-action-${invoice.guid}" ${this.billingWrites?.has(invoice.guid) ? 'disabled' : ''}>${action.label}</button>` : '<span class="os-billing-detail">—</span>'}</td></tr>`;
                }).join('')}</tbody>`;
                table.querySelectorAll('.os-billing-invoice').forEach(button => { button.onclick = () => this.openRecord(button.closest('tr').dataset.invoice, panel); });
                table.querySelectorAll('.os-billing-client').forEach(button => { button.onclick = () => this.openRecord(invoices.find(invoice => invoice.guid === button.closest('tr').dataset.invoice).clientGuid, panel); });
                table.querySelectorAll('.os-billing-row-action').forEach(button => { button.onclick = async () => {
                    const invoice = invoices.find(invoice => invoice.guid === button.closest('tr').dataset.invoice), action = button.dataset.action;
                    if (action !== 'ready') { this.showBillingStateModal(invoice, action, panel); return; }
                    button.disabled = true;
                    try { await this.updateInvoiceState(invoice, 'ready'); this.billingMessage = `${invoice.invoiceId || invoice.name} is ready to send.`; await this.render(panel); document.querySelector(`[data-focus-key="invoice-${invoice.guid}"]`)?.focus({ preventScroll: true }); }
                    catch (error) { this.billingMessage = error.message; await this.render(panel); document.querySelector('.os-billing-search')?.focus(); }
                }; });
            }
            wrap.appendChild(table); results.appendChild(wrap);
        };
        section.querySelector('.os-billing-search').oninput = event => { this.billingSearch = event.target.value; draw(); };
        draw(); return section;
    }
};
