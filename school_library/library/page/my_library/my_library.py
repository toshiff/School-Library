import frappe


@frappe.whitelist()
def get_my_library_data():
    """Find the Library Member for the current user and return their issues."""
    user = frappe.session.user
    if not user or user == "Guest":
        frappe.throw("Please log in to view your library.")

    member = _find_member_for_user(user)
    if not member:
        return {
            "member": None,
            "active_issues": [],
            "history": [],
            "message": "No Library Member account found for you. Please contact the librarian."
        }

    active = frappe.get_all(
        "Book Issue",
        filters={"member": member.name, "return_date": ["is", "not set"]},
        fields=["name", "book", "book_title", "issue_date", "due_date", "status",
                "is_overdue", "overdue_days"],
        order_by="due_date asc",
        ignore_permissions=True
    )

    history = frappe.get_all(
        "Book Issue",
        filters={"member": member.name, "return_date": ["is", "set"]},
        fields=["name", "book", "book_title", "issue_date", "due_date",
                "return_date", "status", "is_overdue", "overdue_days"],
        order_by="issue_date desc",
        limit_page_length=50,
        ignore_permissions=True
    )

    return {
        "member": {
            "name": member.name,
            "member_name": member.member_name,
            "member_type": member.member_type,
            "max_books_allowed": member.max_books_allowed,
            "current_issued_count": member.current_issued_count,
            "is_active": member.is_active
        },
        "active_issues": active,
        "history": history
    }


def _find_member_for_user(user):
    """Match the logged-in user to a Library Member via their Student or Teacher record."""

    # Try Student via email_address
    student_name = frappe.db.get_value("Student", {"email_address": user}, "name")
    if student_name:
        member_name = frappe.db.get_value(
            "Library Member",
            {"member_type": "Student", "student": student_name, "is_active": 1},
            "name"
        )
        if member_name:
            return frappe.get_doc("Library Member", member_name)

    # Try Teacher via user link
    teacher_meta = frappe.get_meta("Teacher")
    user_field = None
    for df in teacher_meta.fields:
        if df.fieldtype == "Link" and df.options == "User":
            user_field = df.fieldname
            break
    if user_field:
        teacher_name = frappe.db.get_value("Teacher", {user_field: user}, "name")
        if teacher_name:
            member_name = frappe.db.get_value(
                "Library Member",
                {"member_type": "Teacher", "teacher": teacher_name, "is_active": 1},
                "name"
            )
            if member_name:
                return frappe.get_doc("Library Member", member_name)

    # Fallback — External member by email
    member_name = frappe.db.get_value(
        "Library Member",
        {"member_type": "External", "external_email": user, "is_active": 1},
        "name"
    )
    if member_name:
        return frappe.get_doc("Library Member", member_name)

    return None
