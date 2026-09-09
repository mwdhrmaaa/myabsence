const studentsService = require('./students.service');
const { sendSuccess, sendCreated, sendNotFound, sendBadRequest } = require('../../core/http/response');

function handleListStudents(req, res) {
    const classId = parseInt(req.params.classId, 10);
    const students = studentsService.getStudentsByClass(classId);
    return sendSuccess(res, { students });
}

function handleCreateStudent(req, res) {
    const classId = parseInt(req.params.classId, 10);
    const { studentNumber, fullName, gender, parentPhone } = req.body;

    if (!studentNumber || !fullName) {
        return sendBadRequest(res, 'Student number and full name are required');
    }

    const student = studentsService.createStudent({
        classId,
        studentNumber: String(studentNumber).trim(),
        fullName: String(fullName).trim(),
        gender: gender || null,
        parentPhone: parentPhone || null
    });

    return sendCreated(res, { student }, 'Student registered successfully');
}

function handleUpdateStudent(req, res) {
    const id = parseInt(req.params.id, 10);
    const updated = studentsService.updateStudent(id, req.body);
    if (!updated) {
        return sendNotFound(res, 'Student not found');
    }
    return sendSuccess(res, { student: updated }, 'Student updated successfully');
}

function handleDeleteStudent(req, res) {
    const id = parseInt(req.params.id, 10);
    const deleted = studentsService.deleteStudent(id);
    if (!deleted) {
        return sendNotFound(res, 'Student not found');
    }
    return sendSuccess(res, { deleted: true }, 'Student removed successfully');
}

function handleImportCsv(req, res) {
    const classId = parseInt(req.params.classId, 10);
    const { csvContent } = req.body;
    if (!csvContent) {
        return sendBadRequest(res, 'CSV content is required');
    }
    const result = studentsService.importStudentsFromCsv(classId, csvContent);
    return sendSuccess(res, result, `Imported ${result.imported} students`);
}

function handleExportCsv(req, res) {
    const classId = parseInt(req.params.classId, 10);
    const csvData = studentsService.exportStudentsCsv(classId);
    res.writeHead(200, {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="students_class_${classId}.csv"`
    });
    res.end(csvData);
}

module.exports = {
    handleListStudents,
    handleCreateStudent,
    handleUpdateStudent,
    handleDeleteStudent,
    handleImportCsv,
    handleExportCsv
};
