import frappe
from frappe.model.document import Document
from frappe.utils import getdate, today, add_days, date_diff


class BookIssue(Document):
    def before_insert(self):
        # Auto-set due_date from settings if blank
        if not self.due_date:
            loan_days = frappe.db.get_single_value("Library Settings", "default_loan_period_days") or 14
            self.due_date = add_days(self.issue_date or today(), int(loan_days))

    def validate(self):
        self._validate_dates()
        self._validate_book_availability()
        self._validate_member_limit()
        self._compute_overdue()

    def _validate_dates(self):
        if not self.issue_date:
            frappe.throw("Issue Date is required.")
        if not self.due_date:
            frappe.throw("Due Date is required.")
        if getdate(self.due_date) < getdate(self.issue_date):
            frappe.throw("Due Date cannot be before Issue Date.")
        if self.return_date and getdate(self.return_date) < getdate(self.issue_date):
            frappe.throw("Return Date cannot be before Issue Date.")

    def _validate_book_availability(self):
        # Only check on new issues (no return_date yet)
        if self.is_new() and self.status == "Issued":
            book = frappe.get_doc("Book", self.book)
            if not book.is_active:
                frappe.throw(f"Book {book.title} is not active.")
            if book.available_copies <= 0:
                frappe.throw(f"No copies of {book.title} are available.")

    def _validate_member_limit(self):
        if self.is_new() and self.status == "Issued":
            member = frappe.get_doc("Library Member", self.member)
            if not member.is_active:
                frappe.throw(f"Member {member.member_name} is not active.")
            if (member.current_issued_count or 0) >= (member.max_books_allowed or 0):
                frappe.throw(
                    f"Member {member.member_name} has reached their limit of "
                    f"{member.max_books_allowed} books."
                )

    def _compute_overdue(self):
        if self.return_date:
            # Returned — overdue only if returned after due date
            if getdate(self.return_date) > getdate(self.due_date):
                self.is_overdue = 1
                self.overdue_days = date_diff(self.return_date, self.due_date)
            else:
                self.is_overdue = 0
                self.overdue_days = 0
        else:
            # Not returned — overdue if today > due date
            if getdate(today()) > getdate(self.due_date):
                self.is_overdue = 1
                self.overdue_days = date_diff(today(), self.due_date)
                if self.status == "Issued":
                    self.status = "Overdue"
            else:
                self.is_overdue = 0
                self.overdue_days = 0

    def after_insert(self):
        # Decrement book available copies, increment member count
        if self.status in ("Issued", "Overdue"):
            self._adjust_stock(-1)
            self._adjust_member_count(1)

    def on_update(self):
        # Detect transition to Returned status
        if self.has_value_changed("return_date") and self.return_date:
            # Just returned now
            if self.status not in ("Returned", "Lost"):
                self.db_set("status", "Returned", update_modified=False)
            self._adjust_stock(1)
            self._adjust_member_count(-1)
        elif self.has_value_changed("status"):
            old_status = self.get_db_value("status")
            new_status = self.status
            # Handle Lost transition (treat like permanent removal — don't restore stock)
            if new_status == "Lost" and old_status in ("Issued", "Overdue"):
                self._adjust_member_count(-1)

    def get_db_value(self, field):
        """Helper to get the stored DB value of a field (pre-update)."""
        return frappe.db.get_value(self.doctype, self.name, field)

    def on_trash(self):
        # Reverse stock/count if deleted while issued
        if self.status in ("Issued", "Overdue") and not self.return_date:
            self._adjust_stock(1)
            self._adjust_member_count(-1)

    def _adjust_stock(self, delta):
        book = frappe.get_doc("Book", self.book)
        new_avail = (book.available_copies or 0) + delta
        if new_avail < 0:
            new_avail = 0
        if new_avail > (book.total_copies or 0):
            new_avail = book.total_copies
        frappe.db.set_value("Book", self.book, "available_copies", new_avail)

    def _adjust_member_count(self, delta):
        member = frappe.get_doc("Library Member", self.member)
        new_count = (member.current_issued_count or 0) + delta
        if new_count < 0:
            new_count = 0
        frappe.db.set_value("Library Member", self.member, "current_issued_count", new_count)


# ============================================================
# Whitelisted API methods
# ============================================================

@frappe.whitelist()
def issue_book(book, member, issue_date=None, due_date=None, remarks=None):
    """Quick issue: create a Book Issue record."""
    issue_date = issue_date or today()
    if not due_date:
        loan_days = frappe.db.get_single_value("Library Settings", "default_loan_period_days") or 14
        due_date = add_days(issue_date, int(loan_days))

    doc = frappe.get_doc({
        "doctype": "Book Issue",
        "book": book,
        "member": member,
        "issue_date": issue_date,
        "due_date": due_date,
        "status": "Issued",
        "remarks": remarks or ""
    })
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return {
        "name": doc.name,
        "book": doc.book,
        "book_title": doc.book_title,
        "member": doc.member,
        "member_name": doc.member_name,
        "issue_date": str(doc.issue_date),
        "due_date": str(doc.due_date),
        "status": doc.status
    }


@frappe.whitelist()
def return_book(issue_name, return_date=None):
    """Mark a Book Issue as returned."""
    return_date = return_date or today()
    doc = frappe.get_doc("Book Issue", issue_name)
    if doc.return_date:
        frappe.throw(f"This issue was already returned on {doc.return_date}.")
    doc.return_date = return_date
    doc.status = "Returned"
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return {
        "name": doc.name,
        "return_date": str(doc.return_date),
        "is_overdue": doc.is_overdue,
        "overdue_days": doc.overdue_days,
        "status": doc.status
    }


@frappe.whitelist()
def get_active_issues_for_member(member):
    """Get all currently-issued (not returned) books for a member."""
    rows = frappe.get_all(
        "Book Issue",
        filters={"member": member, "return_date": ["is", "not set"]},
        fields=["name", "book", "book_title", "issue_date", "due_date", "status",
                "is_overdue", "overdue_days"],
        order_by="due_date asc",
        ignore_permissions=True
    )
    return rows


@frappe.whitelist()
def get_issue_history_for_member(member, limit=50):
    """Get full history (issued + returned) for a member."""
    rows = frappe.get_all(
        "Book Issue",
        filters={"member": member},
        fields=["name", "book", "book_title", "issue_date", "due_date",
                "return_date", "status", "is_overdue", "overdue_days"],
        order_by="issue_date desc",
        limit_page_length=int(limit),
        ignore_permissions=True
    )
    return rows
