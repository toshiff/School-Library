from frappe import _


def get_data():
    return [
        {
            "module_name": "Library",
            "category": "Modules",
            "label": _("Library"),
            "color": "#3F51B5",
            "icon": "octicon octicon-book",
            "type": "module",
            "description": "Library Management System"
        }
    ]
