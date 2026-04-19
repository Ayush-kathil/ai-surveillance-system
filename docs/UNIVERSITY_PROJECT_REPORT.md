# University Project Report

## Title Page

**Project Title:** Surveillance System for Missing Person Detection

**Submitted By:** ____________________

**Roll No.:** ____________________

**Department:** ____________________

**University:** ____________________

**Submission Date:** ____________________

**Guide / Supervisor:** ____________________

---

## Certificate

This is to certify that the project titled **Surveillance System for Missing Person Detection** is a bona fide work carried out by the student named above under my supervision and is submitted in partial fulfillment of the requirements for the award of the degree.

**Signature of Guide:** ____________________

**Signature of Head of Department:** ____________________

---

## Declaration

I hereby declare that the project report submitted herewith is an original work carried out by me and has not been submitted previously for any degree or diploma.

**Student Signature:** ____________________

---

## Acknowledgement

I express my sincere gratitude to my project guide, faculty members, and all those who supported me in completing this project. I also thank the developers of the libraries and frameworks used in this system.

---

## Abstract

This project presents a missing person surveillance system designed to assist in fast visual identification from camera footage. The system accepts a reference photo of the missing person and two surveillance videos as input. A backend detection engine processes the footage, identifies likely matches, and stores evidence snapshots. The frontend provides a structured workflow for uploading inputs, monitoring progress, reviewing alerts, and exporting a professional evidence report.

The system is built as a full-stack application using a FastAPI backend for computer vision processing and a Next.js frontend for the operator interface. The exported report includes session details, detection metrics, marked bounding-box snapshots, and signature fields suitable for academic or operational use.

---

## Table of Contents

1. Introduction
2. Problem Statement
3. Objectives
4. Scope of the Project
5. System Requirements
6. Technology Stack
7. System Architecture
8. Methodology
9. Backend Design
10. Frontend Design
11. Report and Evidence Generation
12. Testing and Validation
13. Results and Discussion
14. Limitations
15. Future Scope
16. Conclusion
17. References

---

## 1. Introduction

Surveillance systems are widely used for public safety, monitoring, and forensic analysis. In a missing person investigation, rapid recognition of a subject from camera footage can reduce response time and improve the chances of timely intervention. Manual review of long video footage is slow and error-prone. This project addresses that problem by combining computer vision, facial embedding comparison, and a guided review workflow.

The application focuses on a practical operator experience. It supports a clean three-step process: upload a missing person photo, upload two surveillance videos, and review live detections with exportable evidence.

---

## 2. Problem Statement

Traditional manual monitoring of surveillance footage is inefficient when an operator must inspect large volumes of video data. The main problem is to detect a missing person accurately from camera feeds and present the evidence in a readable and professional format.

The system should:

- accept a reference image of the missing person,
- process multiple surveillance videos,
- identify probable matches,
- mark detections clearly in snapshots,
- provide progress feedback during analysis,
- and generate a report suitable for submission and review.

---

## 3. Objectives

The main objectives of the project are:

- build an end-to-end missing person detection workflow,
- provide a simple and professional operator interface,
- process surveillance footage using backend AI models,
- show live progress and detection status,
- mark the detected person in bounding-box snapshots,
- export a clear evidence report with timestamps and metrics,
- and maintain a clean, reusable project structure.

---

## 4. Scope of the Project

The project is intended for educational and prototype use. It demonstrates how a modern web application can integrate computer vision analysis and evidence reporting.

The system covers:

- reference image upload,
- dual camera video upload,
- backend detection and matching,
- progress polling,
- snapshot evidence generation,
- PDF export,
- and structured report output.

It does not aim to replace a certified law-enforcement forensic platform.

---

## 5. System Requirements

### Hardware Requirements

- A modern CPU
- Minimum 8 GB RAM recommended
- GPU support optional but beneficial for faster inference
- Camera footage or sample surveillance videos

### Software Requirements

- Windows operating system
- Python environment for backend execution
- Node.js for frontend execution
- Web browser for interface access
- Required Python and JavaScript dependencies installed from the project files

---

## 6. Technology Stack

### Frontend

- Next.js
- React
- Tailwind CSS
- jsPDF for evidence export

### Backend

- FastAPI
- OpenCV
- DeepFace
- Ultralytics YOLO
- NumPy

### Supporting Tools

- PowerShell scripts for setup and launch
- Local file-based snapshot storage
- Professional report export in PDF format

---

## 7. System Architecture

The system follows a full-stack architecture with a separate frontend and backend.

### Main Flow

1. The user uploads a reference photo of the missing person.
2. The user uploads two camera videos.
3. The frontend sends the files to the backend analysis endpoint.
4. The backend extracts facial features from the photo.
5. The backend analyzes camera frames and searches for matching faces.
6. When a probable match is found, the system saves a marked snapshot with a visible detection block.
7. The frontend polls progress and alert endpoints.
8. The operator reviews the detections and exports the report.

---

## 8. Methodology

The project uses a two-stage detection approach:

- person localization using YOLO,
- facial similarity comparison using embedding vectors.

The workflow is designed to improve precision by first finding person regions in the frame and then comparing the detected face crop to the reference encoding.

When a match passes the configured threshold, the backend stores the alert, the timestamp, the similarity score, the Euclidean distance, and a marked image with a visible bounding box around the detected subject.

---

## 9. Backend Design

The backend is implemented with FastAPI and is responsible for analysis, progress tracking, and evidence retrieval.

### Core Responsibilities

- receive uploaded files,
- validate the reference image,
- create an analysis session,
- process both camera feeds,
- track frame progress,
- store alert metadata,
- save marked evidence snapshots,
- and expose endpoints for the frontend.

### Key Backend Features

- asynchronous session processing,
- per-session progress state,
- camera stream endpoints,
- snapshot retrieval endpoint,
- workspace reset endpoint,
- and tuning controls for detection profiles.

### Evidence Marking

Each positive detection now saves an annotated snapshot with a bounding box and a detection label. This makes the report visually clearer and helps the user identify the exact region where the person was detected.

---

## 10. Frontend Design

The frontend is a guided operator console built in Next.js.

### Main Screens

- Home page
- Photo upload page
- Camera upload page
- Review and evidence page

### UX Design Goals

- keep the workflow simple,
- make uploads obvious,
- show progress clearly,
- use restrained transitions and motion,
- avoid visual clutter,
- and keep the interface readable during live analysis.

### Frontend Motion and Feedback

The interface uses subtle animation, staged reveals, upload progress bars, and smooth transitions for a more professional look. The review console displays processing status, alert counts, live streams, and snapshot evidence in a structured format.

### Branding

The site uses the provided logo as the visible brand mark and as the favicon so the web app appears consistent and professional in the browser.

---

## 11. Report and Evidence Generation

The export feature generates a professional PDF report for submission and review.

### Report Content

- project title,
- session ID,
- generation time,
- profile and progress summary,
- alert statistics,
- methodology summary,
- marked evidence timeline,
- bounding-box coordinates,
- and signature fields.

### Marked Evidence

The report now includes detections with marked person blocks. This is important because it shows exactly where the subject was found in the frame, instead of only listing the alert text.

---

## 12. Testing and Validation

The system should be validated with the following checks:

- upload validation for missing image and video files,
- successful backend health check,
- correct session creation,
- progress updates during analysis,
- alert generation when a match is detected,
- bounding-box mark visible in saved snapshots,
- PDF export generation,
- and workspace reset behavior.

A final manual review should confirm that the frontend, backend, logo, favicon, and report output remain consistent.

---

## 13. Results and Discussion

The project provides a usable demonstration of missing person detection from surveillance feeds. The frontend presents the workflow clearly, and the backend produces evidence snapshots that are now marked with the detected subject location.

The report output is structured for academic submission and includes the most important traceability fields: timestamps, similarity scores, distances, and visual evidence.

---

## 14. Limitations

- Accuracy depends on reference image quality.
- Poor lighting and occlusion may reduce recognition reliability.
- Video quality and compression can affect detection performance.
- The project is designed as a prototype and not as a certified forensic product.

---

## 15. Future Scope

The project can be extended with:

- multi-camera scaling,
- OCR-based metadata extraction,
- face re-identification across longer intervals,
- map-based alert logging,
- role-based access control,
- cloud deployment,
- and audit-trail storage for evidence history.

---

## 16. Conclusion

This project demonstrates a complete missing person surveillance workflow with analysis, live progress feedback, evidence capture, and professional report export. The updated implementation now includes marked detection snapshots, which makes the report more useful for review and submission.

The system successfully combines computer vision with a clean frontend experience and a structured evidence output that is suitable for a university project presentation.

---

## 17. References

1. FastAPI Documentation
2. Next.js Documentation
3. OpenCV Documentation
4. DeepFace Documentation
5. Ultralytics YOLO Documentation
6. jsPDF Documentation

---

## Appendix A: Project Deliverables

- Web-based missing person detection workflow
- Dual camera surveillance review console
- Marked detection snapshots
- Exportable PDF evidence report
- Clean branded frontend with logo and favicon
- Clean project structure and setup scripts

---

## Appendix B: Submission Notes

Before submitting the report, replace the placeholders on the title page, certificate, declaration, and acknowledgement sections with your actual academic details.
