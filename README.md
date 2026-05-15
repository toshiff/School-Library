# School Library

A simple library management system that integrates with the [school_edtech](https://github.com/sheikhtousiff/school_edtech) Frappe app.

## Features (v1 — minimal)

- Book master with categories and authors
- Library Members linked to Students or Teachers from school_edtech
- Book Issue / Return workflow with due date and overdue tracking
- Library Dashboard with KPIs
- Issue Book tool for quick check-in/check-out
- My Library portal for students and teachers

## Prerequisites

- Frappe v15
- `school_edtech` app must be installed on the same site

## Installation

```bash
# In your frappe-bench directory
bench get-app https://github.com/YOUR_USERNAME/school_library
bench --site yoursite install-app school_library
```

After install, create the **Librarian** role:

```bash
bench --site yoursite console
>>> import frappe
>>> if not frappe.db.exists('Role', 'Librarian'):
...     frappe.get_doc({'doctype': 'Role', 'role_name': 'Librarian'}).insert(ignore_permissions=True)
...     frappe.db.commit()
>>> exit()
```

Then visit `/app/library-settings` to configure default loan period.

## Pages

- `/app/library-dashboard` — KPIs and overdue tracking
- `/app/issue-book` — quick issue/return tool
- `/app/my-library` — student/teacher portal
- `/app/book` — book master
- `/app/library-member` — member list

## License

MIT
