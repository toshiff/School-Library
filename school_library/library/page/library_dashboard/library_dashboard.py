import frappe
from frappe.utils import today, add_days


@frappe.whitelist()
def get_dashboard_data():
    data = {}

    # Books
    data["total_books"] = frappe.db.count("Book", {"is_active": 1})
    total_copies = frappe.db.sql(
        "SELECT COALESCE(SUM(total_copies),0) FROM `tabBook` WHERE is_active=1"
    )[0][0]
    available_copies = frappe.db.sql(
        "SELECT COALESCE(SUM(available_copies),0) FROM `tabBook` WHERE is_active=1"
    )[0][0]
    data["total_copies"] = int(total_copies or 0)
    data["available_copies"] = int(available_copies or 0)
    data["issued_count"] = data["total_copies"] - data["available_copies"]

    # Members
    data["total_members"] = frappe.db.count("Library Member", {"is_active": 1})

    # Issues
    data["overdue_count"] = frappe.db.count(
        "Book Issue",
        {"status": "Overdue", "return_date": ["is", "not set"]}
    )
    data["today_issues"] = frappe.db.count("Book Issue", {"issue_date": today()})
    data["today_returns"] = frappe.db.count("Book Issue", {"return_date": today()})

    # Overdue list
    data["overdue_list"] = frappe.db.sql("""
        SELECT name, book_title, member_name, issue_date, due_date, overdue_days
        FROM `tabBook Issue`
        WHERE status IN ('Issued','Overdue')
          AND (return_date IS NULL OR return_date = '')
          AND due_date < %s
        ORDER BY due_date ASC
        LIMIT 50
    """, (today(),), as_dict=True)

    # Top borrowers (last 90 days)
    cutoff = add_days(today(), -90)
    data["top_borrowers"] = frappe.db.sql("""
        SELECT member, member_name, COUNT(*) AS issue_count
        FROM `tabBook Issue`
        WHERE issue_date >= %s
        GROUP BY member, member_name
        ORDER BY issue_count DESC
        LIMIT 10
    """, (cutoff,), as_dict=True)

    # Top categories (last 90 days)
    data["top_categories"] = frappe.db.sql("""
        SELECT b.category AS category, COUNT(*) AS issue_count
        FROM `tabBook Issue` bi
        JOIN `tabBook` b ON b.name = bi.book
        WHERE bi.issue_date >= %s AND b.category IS NOT NULL AND b.category != ''
        GROUP BY b.category
        ORDER BY issue_count DESC
        LIMIT 10
    """, (cutoff,), as_dict=True)

    return data
