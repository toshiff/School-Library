frappe.pages['issue-book'].on_page_load = function(wrapper) {
    const page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Issue / Return Books',
        single_column: true
    });

    const $body = $(`
        <div class="issue-book-body">
            <style>
                .ib-grid { display:grid; grid-template-columns:1fr 1fr; gap:18px; margin-top:8px; }
                @media (max-width: 900px) { .ib-grid { grid-template-columns:1fr; } }
                .ib-card { background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:18px; }
                .ib-card h4 { margin:0 0 14px; color:#1e293b; }
                .ib-form-row { margin-bottom:12px; }
                .ib-form-row label { display:block; font-size:12px; color:#64748b; margin-bottom:4px; }
                .ib-actions { margin-top:14px; }
                .ib-result { margin-top:12px; padding:10px; border-radius:6px; font-size:13px; }
                .ib-result.ok { background:#d1fae5; color:#065f46; }
                .ib-result.err { background:#fee2e2; color:#991b1b; }
                .ib-issues-list { margin-top:14px; max-height:300px; overflow-y:auto; border:1px solid #f1f5f9; border-radius:6px; }
                .ib-issue-item { padding:10px 12px; border-bottom:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center; gap:8px; }
                .ib-issue-item:last-child { border-bottom:none; }
                .ib-issue-info { flex:1; min-width:0; }
                .ib-issue-info .title { font-weight:500; color:#1e293b; }
                .ib-issue-info .meta { font-size:11px; color:#64748b; margin-top:2px; }
                .badge-overdue { background:#fee2e2; color:#991b1b; padding:1px 6px; border-radius:8px; font-size:10px; font-weight:500; }
                .ib-empty { padding:14px; text-align:center; color:#94a3b8; font-style:italic; font-size:13px; }
            </style>

            <div class="ib-grid">
                <!-- ISSUE -->
                <div class="ib-card">
                    <h4>📤 Issue a Book</h4>
                    <div class="ib-form-row">
                        <label>Member</label>
                        <div id="issue-member"></div>
                    </div>
                    <div class="ib-form-row">
                        <label>Book</label>
                        <div id="issue-book"></div>
                    </div>
                    <div class="ib-form-row">
                        <label>Issue Date</label>
                        <div id="issue-date"></div>
                    </div>
                    <div class="ib-form-row">
                        <label>Due Date (auto if blank)</label>
                        <div id="issue-due-date"></div>
                    </div>
                    <div class="ib-form-row">
                        <label>Remarks</label>
                        <div id="issue-remarks"></div>
                    </div>
                    <div class="ib-actions">
                        <button class="btn btn-primary btn-sm" id="btn-issue">Issue Book</button>
                    </div>
                    <div id="issue-result"></div>
                </div>

                <!-- RETURN -->
                <div class="ib-card">
                    <h4>📥 Return a Book</h4>
                    <div class="ib-form-row">
                        <label>Member</label>
                        <div id="return-member"></div>
                    </div>
                    <div class="ib-form-row">
                        <label>Return Date</label>
                        <div id="return-date"></div>
                    </div>
                    <div class="ib-issues-list" id="return-issues-list">
                        <div class="ib-empty">Select a member to see their active issues.</div>
                    </div>
                    <div id="return-result"></div>
                </div>
            </div>
        </div>
    `).appendTo(page.body);

    // Form controls — Issue side
    const issueMember = frappe.ui.form.make_control({
        df: { fieldtype: 'Link', options: 'Library Member', placeholder: 'Member',
              get_query: () => ({ filters: { is_active: 1 } }) },
        parent: $('#issue-member')[0],
        render_input: true
    });
    const issueBook = frappe.ui.form.make_control({
        df: { fieldtype: 'Link', options: 'Book', placeholder: 'Book',
              get_query: () => ({ filters: { is_active: 1, available_copies: ['>', 0] } }) },
        parent: $('#issue-book')[0],
        render_input: true
    });
    const issueDate = frappe.ui.form.make_control({
        df: { fieldtype: 'Date', default: frappe.datetime.get_today() },
        parent: $('#issue-date')[0],
        render_input: true
    });
    issueDate.set_value(frappe.datetime.get_today());

    const issueDueDate = frappe.ui.form.make_control({
        df: { fieldtype: 'Date' },
        parent: $('#issue-due-date')[0],
        render_input: true
    });
    const issueRemarks = frappe.ui.form.make_control({
        df: { fieldtype: 'Small Text', placeholder: 'Optional notes' },
        parent: $('#issue-remarks')[0],
        render_input: true
    });

    $('#btn-issue').on('click', function() {
        const member = issueMember.get_value();
        const book = issueBook.get_value();
        const idate = issueDate.get_value();
        const due = issueDueDate.get_value();
        const remarks = issueRemarks.get_value();

        if (!member || !book || !idate) {
            frappe.msgprint('Please fill Member, Book and Issue Date.');
            return;
        }

        frappe.call({
            method: 'school_library.library.doctype.book_issue.book_issue.issue_book',
            args: { book, member, issue_date: idate, due_date: due || null, remarks },
            freeze: true,
            freeze_message: 'Issuing book...',
            callback: function(r) {
                if (r.message) {
                    $('#issue-result').html(`<div class="ib-result ok">
                        ✓ Issued <b>${frappe.utils.escape_html(r.message.book_title)}</b>
                        to <b>${frappe.utils.escape_html(r.message.member_name)}</b>.
                        Due: ${frappe.datetime.str_to_user(r.message.due_date)}.
                        <br><a href="/app/book-issue/${r.message.name}">${r.message.name}</a>
                    </div>`);
                    issueBook.set_value('');
                    issueDueDate.set_value('');
                    issueRemarks.set_value('');
                }
            },
            error: function(err) {
                $('#issue-result').html(`<div class="ib-result err">Failed to issue book.</div>`);
            }
        });
    });

    // Return side
    const returnMember = frappe.ui.form.make_control({
        df: { fieldtype: 'Link', options: 'Library Member', placeholder: 'Member',
              get_query: () => ({ filters: { is_active: 1 } }),
              onchange: function() { load_active_issues(returnMember.get_value()); } },
        parent: $('#return-member')[0],
        render_input: true
    });
    const returnDate = frappe.ui.form.make_control({
        df: { fieldtype: 'Date', default: frappe.datetime.get_today() },
        parent: $('#return-date')[0],
        render_input: true
    });
    returnDate.set_value(frappe.datetime.get_today());

    function load_active_issues(member) {
        const $list = $('#return-issues-list').empty();
        if (!member) {
            $list.html('<div class="ib-empty">Select a member to see their active issues.</div>');
            return;
        }
        frappe.call({
            method: 'school_library.library.doctype.book_issue.book_issue.get_active_issues_for_member',
            args: { member },
            callback: function(r) {
                $list.empty();
                if (!r.message || !r.message.length) {
                    $list.html('<div class="ib-empty">No active issues for this member.</div>');
                    return;
                }
                r.message.forEach(row => {
                    const overdueBadge = row.is_overdue
                        ? ` <span class="badge-overdue">${row.overdue_days}d overdue</span>` : '';
                    const $item = $(`
                        <div class="ib-issue-item">
                            <div class="ib-issue-info">
                                <div class="title">${frappe.utils.escape_html(row.book_title || '')}${overdueBadge}</div>
                                <div class="meta">
                                    Issued ${frappe.datetime.str_to_user(row.issue_date)}
                                    · Due ${frappe.datetime.str_to_user(row.due_date)}
                                    · ${row.name}
                                </div>
                            </div>
                            <button class="btn btn-default btn-xs btn-return-row" data-name="${row.name}">Return</button>
                        </div>
                    `);
                    $list.append($item);
                });
                $list.find('.btn-return-row').on('click', function() {
                    const issueName = $(this).data('name');
                    const rdate = returnDate.get_value() || frappe.datetime.get_today();
                    frappe.call({
                        method: 'school_library.library.doctype.book_issue.book_issue.return_book',
                        args: { issue_name: issueName, return_date: rdate },
                        freeze: true,
                        freeze_message: 'Returning book...',
                        callback: function(r) {
                            if (r.message) {
                                let msg = `✓ Returned <a href="/app/book-issue/${r.message.name}">${r.message.name}</a>`;
                                if (r.message.is_overdue) {
                                    msg += ` <span class="badge-overdue">${r.message.overdue_days}d overdue</span>`;
                                }
                                $('#return-result').html(`<div class="ib-result ok">${msg}</div>`);
                                load_active_issues(returnMember.get_value());
                            }
                        }
                    });
                });
            }
        });
    }
};
