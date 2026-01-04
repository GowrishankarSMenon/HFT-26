import React, { useState } from "react";
import { X, MapPin, Loader2 } from "lucide-react";

const OptimalLocationModal = ({ isOpen, onClose, onFindLocations }) => {
  const [stationCount, setStationCount] = useState(3);
  const [isClosing, setIsClosing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleClose = () => {
    if (isProcessing) return; // Prevent closing during processing
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (stationCount > 0 && stationCount <= 50) {
      setIsProcessing(true);
      setProgress(0);

      // Use setTimeout to allow UI to update
      setTimeout(async () => {
        try {
          await onFindLocations(stationCount, (progressValue) => {
            setProgress(progressValue);
          });
          handleClose();
        } catch (error) {
          console.error("Error finding locations:", error);
          alert(
            "An error occurred while finding optimal locations. Please try again."
          );
        } finally {
          setIsProcessing(false);
          setProgress(0);
        }
      }, 100);
    }
  };

  if (!isOpen && !isClosing) return null;

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center transition-all duration-200 ${
        isClosing ? "opacity-0" : "opacity-100"
      }`}
      style={{ zIndex: 9999 }}
      onClick={!isProcessing ? handleClose : undefined}
    >
      {/* Blurred backdrop */}
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"></div>

      {/* Modal */}
      <div
        className={`relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-md transform transition-all duration-200 ${
          isClosing ? "scale-95 opacity-0" : "scale-100 opacity-100"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <MapPin className="text-green-600" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Find Optimal Locations
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                for EV Charging Stations
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label
              htmlFor="stationCount"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Number of Charging Stations
            </label>
            <input
              id="stationCount"
              type="number"
              min="1"
              max="50"
              value={stationCount}
              onChange={(e) => setStationCount(parseInt(e.target.value) || 1)}
              disabled={isProcessing}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all text-lg font-semibold text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Enter number (1-50)"
            />
            <p className="mt-2 text-xs text-gray-500">
              The algorithm will find the most favorable locations based on cost
              analysis
            </p>
          </div>

          {/* Info Box */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>How it works:</strong> The system analyzes grid cells
              considering charging proximity, population density, substations,
              and adoption likelihood to find optimal placements.
            </p>
          </div>

          {isProcessing && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <Loader2 className="animate-spin text-green-600" size={20} />
                <span className="text-sm font-medium text-green-800">
                  Finding optimal locations... {Math.round(progress)}%
                </span>
              </div>
              <div className="w-full bg-green-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <p className="text-xs text-green-700 mt-2">
                This may take a moment for large areas...
              </p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isProcessing}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Processing...
                </>
              ) : (
                <>
                  <MapPin size={18} />
                  Find Locations
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OptimalLocationModal;
