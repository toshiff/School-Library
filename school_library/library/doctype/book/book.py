import frappe
from frappe.model.document import Document


class Book(Document):
    def before_insert(self):
        # On first save, available = total
        if self.available_copies is None:
            self.available_copies = self.total_copies

    def validate(self):
        if self.total_copies is None or self.total_copies < 0:
            frappe.throw("Total copies must be 0 or more.")
        if self.available_copies is None:
            self.available_copies = self.total_copies
        if self.available_copies < 0:
            frappe.throw("Available copies cannot be negative.")
        if self.available_copies > self.total_copies:
            frappe.throw("Available copies cannot exceed total copies.")
