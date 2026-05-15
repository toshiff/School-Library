frappe.pages['my-library'].on_page_load = function(wrapper) {
    const page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'My Library',
        single_column: true
    });

    const $body = $(`
        <div class="my-lib-body">
            <style>
                .ml-card { background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:18px; margin-bottom:16px; }
                .ml-header { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; }
                .ml-name { font-size:18px; font-weight:600; color:#1e293b; }
                .ml-meta { font-size:13px; color:#64748b; }
                .ml-stats { display:flex; gap:14px; flex-wrap:wrap; }
                .ml-stat { background:#f8fafc; padding:8px 14px; border-radius:6px; font-size:13px; }
                .ml-stat b { color:#1e293b; font-size:16px; }
                .ml-section h4 { margin:0 0 12px; color:#1e293b; }
                .ml-table { width:100%; border-collapse:collapse; }
                .ml-table th { background:#f8fafc; padding:8px 10px; text-align:left; font-size:11px; color:#64748b; text-transform:uppercase; letter-spacing:0.4px; border-bottom:1px solid #e2e8f0; }
                .ml-table td { padding:10px; font-size:13px; border-bottom:1px solid #f1f5f9; }
                .ml-empty { padding:18px; text-align:center; color:#94a3b8; font-style:italic; }
                .badge { padding:2px 8px; border-radius:10px; font-size:11px; font-weight:500; }
                .badge-issued { background:#dbeafe; color:#1e40af; }
                .badge-returned { background:#d1fae5; color:#065f46; }
                .badge-overdue { background:#fee2e2; color:#991b1b; }
                .badge-lost { background:#f3f4f6; color:#374151; }
                .ml-banner-warning { background:#fef3c7; color:#92400e; padding:12px; border-radius:6px; margin-bottom:14px; }
            </style>

            <div id="ml-content">
                <div class="ml-card"><div class="ml-empty">Loading...</div></div>
            </div>
        </div>
    `).appendTo(page.body);

    load_my_library();
};

function load_my_library() {
    frappe.call({
        method: 'school_library.library.page.my_library.my_library.get_my_library_data',
        callback: function(r) {
            const $c = $('#ml-content').empty();
            if (!r.message) return;
            const data = r.message;

            if (!data.member) {
                $c.html(`<div class="ml-card"><div class="ml-banner-warning">
                    ${frappe.utils.escape_html(data.message || 'No library account found.')}
                </div></div>`);
                return;
            }

            // Member info
            const m = data.member;
            $c.append(`
                <div class="ml-card">
                    <div class="ml-header">
                        <div>
                            <div class="ml-name">${frappe.utils.escape_html(m.member_name)}</div>
                            <div class="ml-meta">${m.member_type} · ${m.name}</div>
                        </div>
                        <div class="ml-stats">
                            <div class="ml-stat">Issued <b>${m.current_issued_count || 0}</b></div>
                            <div class="ml-stat">Limit <b>${m.max_books_allowed || 0}</b></div>
                        </div>
                    </div>
                </div>
            `);

            // Active issues
            let activeHtml = '<div class="ml-card ml-section"><h4>Currently Issued</h4>';
            if (!data.active_issues || !data.active_issues.length) {
                activeHtml += '<div class="ml-empty">You have no books issued right now.</div>';
            } else {
                activeHtml += `<table class="ml-table"><thead><tr>
                    <th>Book</th><th>Issued</th><th>Due</th><th>Status</th>
                </tr></thead><tbody>`;
                data.active_issues.forEach(row => {
                    const statusClass = row.is_overdue ? 'badge-overdue' : 'badge-issued';
                    const statusLabel = row.is_overdue ? `Overdue (${row.overdue_days}d)` : 'Issued';
                    activeHtml += `<tr>
                        <td>${frappe.utils.escape_html(row.book_title || '')}</td>
                        <td>${frappe.datetime.str_to_user(row.issue_date)}</td>
                        <td>${frappe.datetime.str_to_user(row.due_date)}</td>
                        <td><span class="badge ${statusClass}">${statusLabel}</span></td>
                    </tr>`;
                });
                activeHtml += '</tbody></table>';
            }
            activeHtml += '</div>';
            $c.append(activeHtml);

            // History
            let histHtml = '<div class="ml-card ml-section"><h4>History</h4>';
            if (!data.history || !data.history.length) {
                histHtml += '<div class="ml-empty">No past book issues yet.</div>';
            } else {
                histHtml += `<table class="ml-table"><thead><tr>
                    <th>Book</th><th>Issued</th><th>Due</th><th>Returned</th><th>Status</th>
                </tr></thead><tbody>`;
                data.history.forEach(row => {
                    let badge = 'badge-returned';
                    let label = 'Returned';
                    if (row.status === 'Lost') { badge = 'badge-lost'; label = 'Lost'; }
                    if (row.is_overdue && row.status === 'Returned') {
                        label = `Returned late (${row.overdue_days}d)`;
                    }
                    histHtml += `<tr>
                        <td>${frappe.utils.escape_html(row.book_title || '')}</td>
                        <td>${frappe.datetime.str_to_user(row.issue_date)}</td>
                        <td>${frappe.datetime.str_to_user(row.due_date)}</td>
                        <td>${row.return_date ? frappe.datetime.str_to_user(row.return_date) : '—'}</td>
                        <td><span class="badge ${badge}">${label}</span></td>
                    </tr>`;
                });
                histHtml += '</tbody></table>';
            }
            histHtml += '</div>';
            $c.append(histHtml);
        }
    });
}
