import frappe
from frappe.model.document import Document


class LibraryMember(Document):
    def validate(self):
        self._validate_type_fields()
        self._auto_fill_member_name()
        self._validate_uniqueness()

    def _validate_type_fields(self):
        if self.member_type == "Student" and not self.student:
            frappe.throw("Student is required when Member Type is Student.")
        elif self.member_type == "Teacher" and not self.teacher:
            frappe.throw("Teacher is required when Member Type is Teacher.")
        elif self.member_type == "External":
            if not self.external_email and not self.external_phone:
                frappe.throw("For External members, Email or Phone is required.")

        # Clear unused fields based on type
        if self.member_type != "Student":
            self.student = None
        if self.member_type != "Teacher":
            self.teacher = None
        if self.member_type != "External":
            self.external_email = None
            self.external_phone = None

    def _auto_fill_member_name(self):
        if self.member_name:
            return
        if self.member_type == "Student" and self.student:
            student_name = frappe.db.get_value("Student", self.student, "student_name")
            if student_name:
                self.member_name = student_name
        elif self.member_type == "Teacher" and self.teacher:
            teacher_name = frappe.db.get_value("Teacher", self.teacher, "teacher_name")
            if teacher_name:
                self.member_name = teacher_name

    def _validate_uniqueness(self):
        if self.member_type == "Student" and self.student:
            existing = frappe.db.get_value(
                "Library Member",
                {"student": self.student, "name": ["!=", self.name or ""]},
                "name"
            )
            if existing:
                frappe.throw(f"A Library Member already exists for this Student: {existing}")
        elif self.member_type == "Teacher" and self.teacher:
            existing = frappe.db.get_value(
                "Library Member",
                {"teacher": self.teacher, "name": ["!=", self.name or ""]},
                "name"
            )
            if existing:
                frappe.throw(f"A Library Member already exists for this Teacher: {existing}")
