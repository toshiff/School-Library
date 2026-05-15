frappe.pages['library-dashboard'].on_page_load = function(wrapper) {
    const page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Library Dashboard',
        single_column: true
    });

    page.set_primary_action('Refresh', () => load_dashboard(page), 'refresh');

    const $body = $(`
        <div class="library-dashboard-body">
            <style>
                .lib-kpi-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(180px,1fr)); gap:12px; margin-top:8px; }
                .lib-kpi { background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:14px; }
                .lib-kpi .kpi-label { font-size:11px; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px; }
                .lib-kpi .kpi-value { font-size:24px; font-weight:600; color:#1e293b; }
                .lib-kpi.overdue .kpi-value { color:#dc2626; }
                .lib-kpi.good .kpi-value { color:#059669; }
                .lib-section { margin-top:22px; }
                .lib-section h4 { margin-bottom:10px; color:#1e293b; }
                .lib-table { width:100%; background:#fff; border:1px solid #e2e8f0; border-radius:6px; border-collapse:separate; border-spacing:0; }
                .lib-table th { background:#f8fafc; padding:8px 12px; text-align:left; font-size:12px; color:#64748b; font-weight:600; border-bottom:1px solid #e2e8f0; }
                .lib-table td { padding:8px 12px; font-size:13px; border-bottom:1px solid #f1f5f9; }
                .lib-table tr:last-child td { border-bottom:none; }
                .lib-empty { padding:18px; text-align:center; color:#94a3b8; font-style:italic; }
                .badge-overdue { background:#fee2e2; color:#991b1b; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:500; }
                .lib-grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:18px; }
                @media (max-width: 768px) { .lib-grid-2 { grid-template-columns:1fr; } }
            </style>

            <div class="lib-kpi-grid" id="lib-kpis"></div>

            <div class="lib-section">
                <h4>Overdue Books</h4>
                <div id="lib-overdue"></div>
            </div>

            <div class="lib-section lib-grid-2">
                <div>
                    <h4>Top Borrowers (Last 90 Days)</h4>
                    <div id="lib-borrowers"></div>
                </div>
                <div>
                    <h4>Top Categories (Last 90 Days)</h4>
                    <div id="lib-categories"></div>
                </div>
            </div>
        </div>
    `).appendTo(page.body);

    load_dashboard(page);
};

function load_dashboard(page) {
    frappe.call({
        method: 'school_library.library.page.library_dashboard.library_dashboard.get_dashboard_data',
        callback: function(r) {
            if (!r.message) return;
            render_dashboard(r.message);
        }
    });
}

function render_dashboard(data) {
    // KPIs
    const $kpis = $('#lib-kpis').empty();
    const kpis = [
        { label: 'Active Books', value: data.total_books, cls: '' },
        { label: 'Total Copies', value: data.total_copies, cls: '' },
        { label: 'Available', value: data.available_copies, cls: 'good' },
        { label: 'Issued', value: data.issued_count, cls: '' },
        { label: 'Overdue', value: data.overdue_count, cls: 'overdue' },
        { label: 'Today Issues', value: data.today_issues, cls: '' },
        { label: 'Today Returns', value: data.today_returns, cls: '' },
        { label: 'Active Members', value: data.total_members, cls: '' }
    ];
    kpis.forEach(k => {
        $kpis.append(`
            <div class="lib-kpi ${k.cls}">
                <div class="kpi-label">${k.label}</div>
                <div class="kpi-value">${k.value}</div>
            </div>
        `);
    });

    // Overdue
    const $overdue = $('#lib-overdue').empty();
    if (!data.overdue_list || !data.overdue_list.length) {
        $overdue.html('<div class="lib-empty">No overdue books — well done!</div>');
    } else {
        let html = `<table class="lib-table"><thead><tr>
            <th>Book</th><th>Member</th><th>Issued</th><th>Due</th><th>Days Overdue</th>
        </tr></thead><tbody>`;
        data.overdue_list.forEach(row => {
            html += `<tr>
                <td><a href="/app/book-issue/${row.name}">${frappe.utils.escape_html(row.book_title || '')}</a></td>
                <td>${frappe.utils.escape_html(row.member_name || '')}</td>
                <td>${frappe.datetime.str_to_user(row.issue_date)}</td>
                <td>${frappe.datetime.str_to_user(row.due_date)}</td>
                <td><span class="badge-overdue">${row.overdue_days} days</span></td>
            </tr>`;
        });
        html += '</tbody></table>';
        $overdue.html(html);
    }

    // Top borrowers
    const $borrowers = $('#lib-borrowers').empty();
    if (!data.top_borrowers || !data.top_borrowers.length) {
        $borrowers.html('<div class="lib-empty">No issues in last 90 days.</div>');
    } else {
        let html = `<table class="lib-table"><thead><tr>
            <th>Member</th><th>Books Borrowed</th>
        </tr></thead><tbody>`;
        data.top_borrowers.forEach(row => {
            html += `<tr>
                <td><a href="/app/library-member/${row.member}">${frappe.utils.escape_html(row.member_name || '')}</a></td>
                <td>${row.issue_count}</td>
            </tr>`;
        });
        html += '</tbody></table>';
        $borrowers.html(html);
    }

    // Top categories
    const $cats = $('#lib-categories').empty();
    if (!data.top_categories || !data.top_categories.length) {
        $cats.html('<div class="lib-empty">No issues in last 90 days.</div>');
    } else {
        let html = `<table class="lib-table"><thead><tr>
            <th>Category</th><th>Issues</th>
        </tr></thead><tbody>`;
        data.top_categories.forEach(row => {
            html += `<tr>
                <td>${frappe.utils.escape_html(row.category || '')}</td>
                <td>${row.issue_count}</td>
            </tr>`;
        });
        html += '</tbody></table>';
        $cats.html(html);
    }
}
