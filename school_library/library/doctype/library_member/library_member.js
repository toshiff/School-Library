// Copyright (c) 2026, Sheikh Tousiff and contributors
// For license information, please see license.txt

frappe.ui.form.on('Library Member', {
    student: function(frm) {
        if (frm.doc.member_type === 'Student' && frm.doc.student) {
            frappe.db.get_value('Student', frm.doc.student, 'student_name')
                .then(r => {
                    if (r && r.message && r.message.student_name) {
                        frm.set_value('member_name', r.message.student_name);
                    }
                });
        }
    },

    teacher: function(frm) {
        if (frm.doc.member_type === 'Teacher' && frm.doc.teacher) {
            frappe.db.get_value('Teacher', frm.doc.teacher, 'teacher_name')
                .then(r => {
                    if (r && r.message && r.message.teacher_name) {
                        frm.set_value('member_name', r.message.teacher_name);
                    }
                });
        }
    }
});