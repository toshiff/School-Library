import frappe


@frappe.whitelist()
def search_books(category=None, book_name=None, only_active=1):
    """Search books with computed issued count and copy availability.

    Filters:
      - category: Book Category (Link)
      - book_name: substring match on title (case-insensitive)
      - only_active: if truthy, only books with is_active=1
    """
    conditions = []
    params = {}

    if int(only_active or 0):
        conditions.append("b.is_active = 1")

    if category:
        conditions.append("b.category = %(category)s")
        params["category"] = category

    if book_name:
        conditions.append("LOWER(b.title) LIKE %(title)s")
        params["title"] = f"%{book_name.lower()}%"

    where_sql = (" WHERE " + " AND ".join(conditions)) if conditions else ""

    rows = frappe.db.sql(f"""
        SELECT
            b.name                  AS book_id,
            b.title                 AS title,
            b.isbn                  AS isbn,
            b.category              AS category,
            b.author                AS author,
            b.publisher             AS publisher,
            b.shelf_location        AS shelf_location,
            b.total_copies          AS total_copies,
            b.available_copies      AS available_copies,
            (b.total_copies - b.available_copies) AS issued_count,
            b.is_active             AS is_active
        FROM `tabBook` b
        {where_sql}
        ORDER BY b.title ASC
        LIMIT 500
    """, params, as_dict=True)

    return rows


@frappe.whitelist()
def get_book_details(book):
    """Get full details for a single book + list of active borrowers."""
    if not book:
        frappe.throw("Book is required.")

    book_doc = frappe.db.get_value(
        "Book",
        book,
        ["name", "title", "isbn", "edition", "category", "author", "publisher",
         "shelf_location", "language", "year_published", "total_copies",
         "available_copies", "is_active", "summary"],
        as_dict=True
    )
    if not book_doc:
        frappe.throw(f"Book {book} not found.")

    book_doc["issued_count"] = (book_doc["total_copies"] or 0) - (book_doc["available_copies"] or 0)

    # Active borrowers (not yet returned)
    active_issues = frappe.db.sql("""
        SELECT
            bi.name           AS issue_id,
            bi.member         AS member_id,
            bi.member_name    AS member_name,
            bi.issue_date     AS issue_date,
            bi.due_date       AS due_date,
            bi.status         AS status,
            bi.is_overdue     AS is_overdue,
            bi.overdue_days   AS overdue_days,
            lm.member_type    AS member_type,
            lm.student        AS student,
            lm.teacher        AS teacher,
            lm.external_email AS external_email,
            lm.external_phone AS external_phone
        FROM `tabBook Issue` bi
        LEFT JOIN `tabLibrary Member` lm ON lm.name = bi.member
        WHERE bi.book = %(book)s
          AND (bi.return_date IS NULL OR bi.return_date = '')
          AND bi.status IN ('Issued', 'Overdue')
        ORDER BY bi.due_date ASC
    """, {"book": book}, as_dict=True)

    # Recent return history (last 20)
    recent_history = frappe.db.sql("""
        SELECT
            bi.name           AS issue_id,
            bi.member         AS member_id,
            bi.member_name    AS member_name,
            bi.issue_date     AS issue_date,
            bi.due_date       AS due_date,
            bi.return_date    AS return_date,
            bi.status         AS status,
            bi.is_overdue     AS is_overdue,
            bi.overdue_days   AS overdue_days
        FROM `tabBook Issue` bi
        WHERE bi.book = %(book)s
          AND bi.return_date IS NOT NULL
          AND bi.return_date != ''
        ORDER BY bi.return_date DESC
        LIMIT 20
    """, {"book": book}, as_dict=True)

    return {
        "book": book_doc,
        "active_issues": active_issues,
        "recent_history": recent_history
    }
