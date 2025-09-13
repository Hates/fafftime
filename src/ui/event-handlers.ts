// =============================================================================
// EVENT HANDLERS & DOM INTERACTIONS
// =============================================================================

import { TimeRange, FitData } from '../types/app-types';
import { decodeFitFile } from '../core/fit-parser';
import { prepareUIForParsing, handleFitParsingError } from './dom-manager';
import { updateMapOverlays, getActivityMap } from './map-manager';

// Global State
let currentFitData: FitData | null = null;
let currentFileName: string | null = null;

// DOM Elements
const fileInput = document.getElementById('fitFile') as HTMLInputElement | null;
const fileDropArea = document.getElementById('fileDropArea') as HTMLElement | null;
const fileSelectButton = document.getElementById('fileSelectButton') as HTMLButtonElement | null;
const selectedFileDiv = document.getElementById('selectedFile') as HTMLElement | null;
const fileNameSpan = document.getElementById('fileName') as HTMLSpanElement | null;
const removeFileButton = document.getElementById('removeFile') as HTMLButtonElement | null;
const showPeriodsOnMapCheckbox = document.getElementById('showPeriodsOnMap') as HTMLInputElement | null;
const loadExampleFileLink = document.getElementById('loadExampleFile') as HTMLAnchorElement | null;
const timestampGapThresholdSelect = document.getElementById('timestampGapThreshold') as HTMLSelectElement | null;

const thresholdCheckboxes: Record<TimeRange, HTMLInputElement | null> = {
  '2to5': document.getElementById('threshold_2to5') as HTMLInputElement | null,
  '5to10': document.getElementById('threshold_5to10') as HTMLInputElement | null,
  '10to30': document.getElementById('threshold_10to30') as HTMLInputElement | null,
  '30to60': document.getElementById('threshold_30to60') as HTMLInputElement | null,
  '1to2hours': document.getElementById('threshold_1to2hours') as HTMLInputElement | null,
  'over2hours': document.getElementById('threshold_over2hours') as HTMLInputElement | null
};

/**
 * Initializes all event handlers for the application
 */
export function initializeEventHandlers(
  parseFitFileCallback: (file: File) => Promise<void>,
  displayActivityDataCallback: (fitData: FitData, fileName: string) => void,
  loadExampleFileCallback: () => Promise<void>
): void {

  // File input change handler
  fileInput?.addEventListener('change', async function(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    await handleFileSelection(file || null, parseFitFileCallback);
  });

  // File select button click handler
  fileSelectButton?.addEventListener('click', function() {
    fileInput?.click();
  });

  // Remove file button handler
  removeFileButton?.addEventListener('click', function() {
    if (fileInput) fileInput.value = '';
    if (selectedFileDiv) selectedFileDiv.style.display = 'none';
    if (fileDropArea) fileDropArea.style.display = 'block';
  });

  // Drag and drop handlers
  fileDropArea?.addEventListener('click', function() {
    fileInput?.click();
  });

  fileDropArea?.addEventListener('dragover', function(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    fileDropArea.classList.add('drag-over');
  });

  fileDropArea?.addEventListener('dragleave', function(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    fileDropArea.classList.remove('drag-over');
  });

  fileDropArea?.addEventListener('drop', async function(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    fileDropArea.classList.remove('drag-over');

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      // Set the file to the hidden input
      if (fileInput) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;
      }
      await handleFileSelection(file, parseFitFileCallback);
    }
  });

  // Example file load handler
  loadExampleFileLink?.addEventListener('click', async function(event: Event) {
    event.preventDefault();
    await loadExampleFileCallback();
  });

  // Threshold filter change handlers
  Object.values(thresholdCheckboxes).forEach(checkbox => {
    checkbox?.addEventListener('change', function() {
      if (currentFitData && currentFileName) {
        displayActivityDataCallback(currentFitData, currentFileName);
      }
    });
  });

  // Map overlay toggle handler
  showPeriodsOnMapCheckbox?.addEventListener('change', function() {
    const activityMap = getActivityMap();
    if (activityMap) {
      updateMapOverlays();
    }
  });

  // Timestamp gap threshold change handler
  timestampGapThresholdSelect?.addEventListener('change', function() {
    if (currentFitData && currentFileName) {
      displayActivityDataCallback(currentFitData, currentFileName);
    }
  });
}

/**
 * Helper function to handle file selection
 */
async function handleFileSelection(file: File | null, parseFitFileCallback: (file: File) => Promise<void>): Promise<void> {
  if (file && file.name.toLowerCase().endsWith('.fit')) {
    // Show selected file
    if (fileNameSpan) fileNameSpan.textContent = file.name;
    if (selectedFileDiv) selectedFileDiv.style.display = 'flex';
    if (fileDropArea) fileDropArea.style.display = 'none';

    // Automatically parse the file
    await parseFitFileCallback(file);
  } else if (file) {
    // Invalid file type
    alert('Please select a .fit file');
  }
}

/**
 * Updates the global state with current FIT data
 */
export function setCurrentFitData(fitData: FitData, fileName: string): void {
  currentFitData = fitData;
  currentFileName = fileName;
}

/**
 * Gets the current FIT data
 */
export function getCurrentFitData(): { fitData: FitData | null; fileName: string | null } {
  return { fitData: currentFitData, fileName: currentFileName };
}

/**
 * Updates the file selection UI for the example file
 */
export function updateUIForExampleFile(fileName: string): void {
  if (fileNameSpan) fileNameSpan.textContent = `${fileName} (example)`;
  if (selectedFileDiv) selectedFileDiv.style.display = 'flex';
  if (fileDropArea) fileDropArea.style.display = 'none';
}