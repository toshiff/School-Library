frappe.pages['lib-book-inventory'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Book Inventory',
		single_column: true
	});

    page.set_primary_action('Search', () => run_search(page), 'search');
    page.set_secondary_action('Clear', () => clear_filters(page));

    const $body = $(`
        <div class="bir-body">
            <style>
                .bir-filters { background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:16px; margin-bottom:14px; }
                .bir-filter-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; align-items:end; }
                @media (max-width: 900px) { .bir-filter-grid { grid-template-columns:1fr; } }
                .bir-summary { display:grid; grid-template-columns:repeat(auto-fill, minmax(150px,1fr)); gap:10px; margin-bottom:14px; }
                .bir-summary-card { background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:12px; }
                .bir-summary-card .label { font-size:11px; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px; }
                .bir-summary-card .value { font-size:22px; font-weight:600; color:#1e293b; }
                .bir-summary-card.issued .value { color:#dc2626; }
                .bir-summary-card.available .value { color:#059669; }
                .bir-result-card { background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:0; overflow:hidden; }
                .bir-table { width:100%; border-collapse:separate; border-spacing:0; }
                .bir-table th { background:#f8fafc; padding:10px 12px; text-align:left; font-size:11px; color:#64748b; text-transform:uppercase; letter-spacing:0.4px; font-weight:600; border-bottom:1px solid #e2e8f0; }
                .bir-table td { padding:10px 12px; font-size:13px; border-bottom:1px solid #f1f5f9; vertical-align:middle; }
                .bir-table tr:last-child td { border-bottom:none; }
                .bir-table tr.clickable { cursor:pointer; }
                .bir-table tr.clickable:hover { background:#f8fafc; }
                .bir-table .title-cell { font-weight:500; color:#1e293b; }
                .bir-table .muted { color:#94a3b8; font-size:12px; }
                .bir-empty { padding:30px; text-align:center; color:#94a3b8; font-style:italic; }
                .badge { padding:2px 8px; border-radius:10px; font-size:11px; font-weight:500; display:inline-block; }
                .badge-ok { background:#d1fae5; color:#065f46; }
                .badge-issued { background:#dbeafe; color:#1e40af; }
                .badge-overdue { background:#fee2e2; color:#991b1b; }
                .badge-empty { background:#fef3c7; color:#92400e; }
                .badge-inactive { background:#f3f4f6; color:#6b7280; }
                .copy-bar { display:inline-flex; align-items:center; gap:6px; }
                .copy-mini { font-size:11px; color:#64748b; }

                /* Detail dialog */
                .bir-detail { padding:4px; }
                .bir-detail .book-meta { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:18px; }
                .bir-detail .meta-item { font-size:13px; }
                .bir-detail .meta-item .label { font-size:11px; color:#64748b; text-transform:uppercase; }
                .bir-detail .meta-item .value { color:#1e293b; font-weight:500; }
                .bir-detail h5 { margin:18px 0 10px; color:#1e293b; font-size:14px; }
                .bir-detail .stats-row { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:18px; }
                .bir-detail .stat-mini { background:#f8fafc; border-radius:6px; padding:10px; text-align:center; }
                .bir-detail .stat-mini .num { font-size:20px; font-weight:600; color:#1e293b; }
                .bir-detail .stat-mini.issued .num { color:#dc2626; }
                .bir-detail .stat-mini.available .num { color:#059669; }
                .bir-detail .stat-mini .lbl { font-size:11px; color:#64748b; text-transform:uppercase; margin-top:2px; }
            </style>

            <div class="bir-filters">
                <div class="bir-filter-grid">
                    <div>
                        <label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;">Book Category</label>
                        <div id="bir-filter-category"></div>
                    </div>
                    <div>
                        <label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;">Book Name (contains)</label>
                        <div id="bir-filter-name"></div>
                    </div>
                    <div>
                        <label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;">Show</label>
                        <div id="bir-filter-active"></div>
                    </div>
                </div>
            </div>

            <div id="bir-summary"></div>
            <div id="bir-results"><div class="bir-result-card"><div class="bir-empty">Set filters above and click Search.</div></div></div>
        </div>
    `).appendTo(page.body);

    // Filter controls
    const categoryCtrl = frappe.ui.form.make_control({
        df: { fieldtype: 'Link', options: 'Book Category', placeholder: 'All categories' },
        parent: $('#bir-filter-category')[0],
        render_input: true
    });

    const nameCtrl = frappe.ui.form.make_control({
        df: { fieldtype: 'Data', placeholder: 'e.g. python' },
        parent: $('#bir-filter-name')[0],
        render_input: true
    });

    const activeCtrl = frappe.ui.form.make_control({
        df: { fieldtype: 'Select', options: 'Active only\nAll books', default: 'Active only' },
        parent: $('#bir-filter-active')[0],
        render_input: true
    });
    activeCtrl.set_value('Active only');

    // Enter to search
    nameCtrl.$input && nameCtrl.$input.on('keydown', function(e) {
        if (e.key === 'Enter') { e.preventDefault(); run_search(page); }
    });

    // Stash on page for cross-function access
    page.bir = { categoryCtrl, nameCtrl, activeCtrl };

    // Initial: show all active books on load
    run_search(page);
};

function clear_filters(page) {
    page.bir.categoryCtrl.set_value('');
    page.bir.nameCtrl.set_value('');
    page.bir.activeCtrl.set_value('Active only');
    run_search(page);
}

function run_search(page) {
    const category = page.bir.categoryCtrl.get_value();
    const book_name = page.bir.nameCtrl.get_value();
    const onlyActive = page.bir.activeCtrl.get_value() === 'Active only' ? 1 : 0;

    frappe.call({
        method: 'school_library.library.page.lib_book_inventory.lib_book_inventory.search_books',
        args: { category, book_name, only_active: onlyActive },
        callback: function(r) {
            render_results(r.message || []);
        }
    });
}

function render_results(rows) {
    // Summary
    const $sum = $('#bir-summary').empty();
    if (rows.length) {
        const totalBooks = rows.length;
        const totalCopies = rows.reduce((a, r) => a + (r.total_copies || 0), 0);
        const totalAvail = rows.reduce((a, r) => a + (r.available_copies || 0), 0);
        const totalIssued = rows.reduce((a, r) => a + (r.issued_count || 0), 0);
        $sum.html(`
            <div class="bir-summary">
                <div class="bir-summary-card"><div class="label">Books Found</div><div class="value">${totalBooks}</div></div>
                <div class="bir-summary-card"><div class="label">Total Copies</div><div class="value">${totalCopies}</div></div>
                <div class="bir-summary-card available"><div class="label">Available</div><div class="value">${totalAvail}</div></div>
                <div class="bir-summary-card issued"><div class="label">Issued</div><div class="value">${totalIssued}</div></div>
            </div>
        `);
    }

    // List
    const $res = $('#bir-results').empty();
    if (!rows.length) {
        $res.html('<div class="bir-result-card"><div class="bir-empty">No books match your filters.</div></div>');
        return;
    }

    let html = `<div class="bir-result-card"><table class="bir-table"><thead><tr>
        <th>Title</th><th>Category</th><th>Author</th><th>Total</th><th>Available</th><th>Issued</th><th>Status</th>
    </tr></thead><tbody>`;

    rows.forEach(row => {
        let statusBadge = '';
        if (!row.is_active) {
            statusBadge = '<span class="badge badge-inactive">Inactive</span>';
        } else if (row.available_copies === 0 && row.total_copies > 0) {
            statusBadge = '<span class="badge badge-empty">All Out</span>';
        } else if (row.issued_count > 0) {
            statusBadge = '<span class="badge badge-issued">Some Issued</span>';
        } else {
            statusBadge = '<span class="badge badge-ok">All Available</span>';
        }

        html += `<tr class="clickable" data-book="${row.book_id}">
            <td class="title-cell">
                ${frappe.utils.escape_html(row.title || '')}
                ${row.isbn ? `<div class="muted">ISBN: ${frappe.utils.escape_html(row.isbn)}</div>` : ''}
            </td>
            <td>${frappe.utils.escape_html(row.category || '—')}</td>
            <td>${frappe.utils.escape_html(row.author || '—')}</td>
            <td>${row.total_copies || 0}</td>
            <td><b style="color:#059669;">${row.available_copies || 0}</b></td>
            <td><b style="color:#dc2626;">${row.issued_count || 0}</b></td>
            <td>${statusBadge}</td>
        </tr>`;
    });

    html += '</tbody></table></div>';
    $res.html(html);

    // Row click → drill-down
    $res.find('tr.clickable').on('click', function() {
        const bookId = $(this).data('book');
        open_book_detail(bookId);
    });
}

function open_book_detail(bookId) {
    frappe.call({
        method: 'school_library.library.page.lib_book_inventory.lib_book_inventory.get_book_details',
        args: { book: bookId },
        freeze: true,
        freeze_message: 'Loading book details...',
        callback: function(r) {
            if (!r.message) return;
            show_detail_dialog(r.message);
        }
    });
}

function show_detail_dialog(data) {
    const b = data.book;

    const detailHtml = build_detail_html(b, data.active_issues, data.recent_history);

    const d = new frappe.ui.Dialog({
        title: b.title,
        size: 'large',
        fields: [
            { fieldtype: 'HTML', fieldname: 'detail_html', options: detailHtml }
        ],
        primary_action_label: 'Open Book',
        primary_action: function() {
            frappe.set_route('Form', 'Book', b.name);
            d.hide();
        }
    });

    d.show();
}

function build_detail_html(b, active, history) {
    // Book metadata
    const meta_pairs = [
        ['Book ID', b.name],
        ['ISBN', b.isbn || '—'],
        ['Edition', b.edition || '—'],
        ['Category', b.category || '—'],
        ['Author', b.author || '—'],
        ['Publisher', b.publisher || '—'],
        ['Language', b.language || '—'],
        ['Year', b.year_published || '—'],
        ['Shelf', b.shelf_location || '—'],
        ['Status', b.is_active ? 'Active' : 'Inactive']
    ];
    let metaHtml = '<div class="book-meta">';
    meta_pairs.forEach(([label, value]) => {
        metaHtml += `<div class="meta-item">
            <div class="label">${label}</div>
            <div class="value">${frappe.utils.escape_html(String(value))}</div>
        </div>`;
    });
    metaHtml += '</div>';

    // Stats
    const statsHtml = `
        <div class="stats-row">
            <div class="stat-mini"><div class="num">${b.total_copies || 0}</div><div class="lbl">Total Copies</div></div>
            <div class="stat-mini available"><div class="num">${b.available_copies || 0}</div><div class="lbl">Available</div></div>
            <div class="stat-mini issued"><div class="num">${b.issued_count || 0}</div><div class="lbl">Currently Issued</div></div>
        </div>
    `;

    // Active borrowers
    let activeHtml = '<h5>📕 Currently Issued To</h5>';
    if (!active || !active.length) {
        activeHtml += '<div class="bir-empty" style="padding:14px;">No copies currently issued — all copies are in the library.</div>';
    } else {
        activeHtml += `<table class="bir-table"><thead><tr>
            <th>Member</th><th>Type</th><th>Issued</th><th>Due</th><th>Status</th><th></th>
        </tr></thead><tbody>`;
        active.forEach(row => {
            const memberLink = `<a href="/app/library-member/${row.member_id}" target="_blank">${frappe.utils.escape_html(row.member_name || row.member_id)}</a>`;
            const statusBadge = row.is_overdue
                ? `<span class="badge badge-overdue">Overdue ${row.overdue_days}d</span>`
                : '<span class="badge badge-issued">Issued</span>';
            activeHtml += `<tr>
                <td>${memberLink}</td>
                <td>${frappe.utils.escape_html(row.member_type || '')}</td>
                <td>${frappe.datetime.str_to_user(row.issue_date)}</td>
                <td>${frappe.datetime.str_to_user(row.due_date)}</td>
                <td>${statusBadge}</td>
                <td><a href="/app/book-issue/${row.issue_id}" target="_blank" class="muted">${row.issue_id}</a></td>
            </tr>`;
        });
        activeHtml += '</tbody></table>';
    }

    // Recent returns
    let histHtml = '<h5 style="margin-top:18px;">🕓 Recent Returns</h5>';
    if (!history || !history.length) {
        histHtml += '<div class="bir-empty" style="padding:14px;">No return history yet.</div>';
    } else {
        histHtml += `<table class="bir-table"><thead><tr>
            <th>Member</th><th>Issued</th><th>Due</th><th>Returned</th><th>Note</th>
        </tr></thead><tbody>`;
        history.forEach(row => {
            const memberLink = `<a href="/app/library-member/${row.member_id}" target="_blank">${frappe.utils.escape_html(row.member_name || row.member_id)}</a>`;
            const lateNote = row.is_overdue
                ? `<span class="badge badge-overdue">${row.overdue_days}d late</span>`
                : '<span class="badge badge-ok">On time</span>';
            histHtml += `<tr>
                <td>${memberLink}</td>
                <td>${frappe.datetime.str_to_user(row.issue_date)}</td>
                <td>${frappe.datetime.str_to_user(row.due_date)}</td>
                <td>${frappe.datetime.str_to_user(row.return_date)}</td>
                <td>${lateNote}</td>
            </tr>`;
        });
        histHtml += '</tbody></table>';
    }

    return `<div class="bir-detail">${statsHtml}${metaHtml}${activeHtml}${histHtml}</div>`;
}