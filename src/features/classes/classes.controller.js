const classesService = require('./classes.service');
const { sendSuccess, sendCreated, sendNotFound, sendBadRequest } = require('../../core/http/response');

function handleListClasses(req, res) {
    const classes = classesService.getAllClasses();
    return sendSuccess(res, { classes });
}

function handleGetClass(req, res) {
    const classId = parseInt(req.params.id, 10);
    const classData = classesService.getClassById(classId);
    if (!classData) {
        return sendNotFound(res, `Class with ID ${classId} not found`);
    }
    return sendSuccess(res, { class: classData });
}

function handleCreateClass(req, res) {
    const { name, gradeLevel, room } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
        return sendBadRequest(res, 'Class name is required');
    }
    const newClass = classesService.createClass({
        name: name.trim(),
        gradeLevel: gradeLevel ? gradeLevel.trim() : 'General',
        room: room ? room.trim() : ''
    });
    return sendCreated(res, { class: newClass }, 'Class created successfully');
}

function handleUpdateClass(req, res) {
    const classId = parseInt(req.params.id, 10);
    const updated = classesService.updateClass(classId, req.body);
    if (!updated) {
        return sendNotFound(res, 'Class not found');
    }
    return sendSuccess(res, { class: updated }, 'Class updated successfully');
}

function handleDeleteClass(req, res) {
    const classId = parseInt(req.params.id, 10);
    const deleted = classesService.deleteClass(classId);
    if (!deleted) {
        return sendNotFound(res, 'Class not found');
    }
    return sendSuccess(res, { deleted: true }, 'Class deleted successfully');
}

module.exports = {
    handleListClasses,
    handleGetClass,
    handleCreateClass,
    handleUpdateClass,
    handleDeleteClass
};
