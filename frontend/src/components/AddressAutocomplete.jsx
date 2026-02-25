/**
 * AddressAutocomplete
 * ─────────────────────────────────────────────────────
 * Renders an address line input with Google Places autocomplete suggestions.
 * When a suggestion is selected, calls onAddressSelect({ line1, city, state, zip, country, lat, lng }).
 *
 * Also exposes a "Pick on Map" button that opens an inline map.
 * Click anywhere on the map to reverse-geocode and fill the fields.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, Loader2, X } from 'lucide-react';

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

/* Load Maps JS API once per session */
let scriptPromise = null;
function loadMapsScript() {
  if (!MAPS_API_KEY) return Promise.reject(new Error('Google Maps API key not configured'));
  if (window.google?.maps?.places) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/* Parse Google address_components into flat fields */
function parsePlace(place) {
  const get = (types, nameType = 'long_name') => {
    const comp = place.address_components?.find((c) => types.some((t) => c.types.includes(t)));
    return comp ? comp[nameType] : '';
  };
  const streetNumber = get(['street_number']);
  const route = get(['route']);
  const line1 = [streetNumber, route].filter(Boolean).join(' ') || place.formatted_address?.split(',')[0] || '';
  return {
    line1,
    city: get(['locality', 'administrative_area_level_2']),
    state: get(['administrative_area_level_1']),
    zip: get(['postal_code']),
    country: get(['country']),
    lat: place.geometry?.location?.lat() || null,
    lng: place.geometry?.location?.lng() || null,
    formatted: place.formatted_address || '',
  };
}

export default function AddressAutocomplete({
  value = '',
  onChange,           // (newLine1: string) => void
  onAddressSelect,    // ({ line1, city, state, zip, country, lat, lng }) => void
  placeholder = 'Search address...',
  className = '',
}) {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const geocoderRef = useRef(null);

  const [mapsReady, setMapsReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);

  /* Load script on mount */
  useEffect(() => {
    if (!MAPS_API_KEY) return;
    setLoading(true);
    loadMapsScript()
      .then(() => setMapsReady(true))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  /* Attach Autocomplete to input once Maps is ready */
  useEffect(() => {
    if (!mapsReady || !inputRef.current) return;
    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      fields: ['address_components', 'formatted_address', 'geometry'],
    });
    autocompleteRef.current = autocomplete;

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (!place?.address_components) return;
      const parsed = parsePlace(place);
      onChange?.(parsed.line1);
      onAddressSelect?.(parsed);
    });

    return () => {
      window.google.maps.event.clearInstanceListeners(autocomplete);
    };
  }, [mapsReady]);

  /* Build map when modal opens */
  useEffect(() => {
    if (!mapOpen || !mapsReady || !mapRef.current) return;
    setMapLoading(true);

    const defaultCenter = { lat: 20.5937, lng: 78.9629 }; // India center
    const map = new window.google.maps.Map(mapRef.current, {
      center: defaultCenter,
      zoom: 5,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });
    mapInstanceRef.current = map;

    const marker = new window.google.maps.Marker({
      map,
      draggable: true,
      visible: false,
    });
    markerRef.current = marker;
    geocoderRef.current = new window.google.maps.Geocoder();
    setMapLoading(false);

    /* Click on map → drop marker + reverse geocode */
    map.addListener('click', (e) => {
      const latLng = e.latLng;
      marker.setPosition(latLng);
      marker.setVisible(true);
      geocoderRef.current.geocode({ location: latLng }, (results, status) => {
        if (status === 'OK' && results[0]) {
          const parsed = parsePlace(results[0]);
          onChange?.(parsed.line1);
          onAddressSelect?.({ ...parsed, lat: latLng.lat(), lng: latLng.lng() });
        }
      });
    });

    /* Drag marker end → reverse geocode */
    marker.addListener('dragend', (e) => {
      const latLng = e.latLng;
      geocoderRef.current.geocode({ location: latLng }, (results, status) => {
        if (status === 'OK' && results[0]) {
          const parsed = parsePlace(results[0]);
          onChange?.(parsed.line1);
          onAddressSelect?.({ ...parsed, lat: latLng.lat(), lng: latLng.lng() });
        }
      });
    });
  }, [mapOpen, mapsReady]);

  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide">Address Line</label>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          className="w-full glass-input px-3.5 py-2.5 text-sm pr-20"
          autoComplete="off"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {loading && <Loader2 size={14} className="animate-spin text-slate-400" />}
          {MAPS_API_KEY && (
            <button
              type="button"
              onClick={() => setMapOpen(true)}
              className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 transition-colors font-medium px-1.5 py-1 rounded hover:bg-violet-50"
              title="Pick on map"
            >
              <MapPin size={13} />
              Map
            </button>
          )}
        </div>
      </div>

      {/* Map Modal */}
      {mapOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-violet-600" />
                <span className="font-semibold text-slate-700 text-sm">Pick Location on Map</span>
              </div>
              <button onClick={() => setMapOpen(false)} className="p-1 rounded-lg hover:bg-gray-100 text-slate-400 hover:text-slate-600 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="px-4 py-2 bg-violet-50/50 text-xs text-slate-500 border-b border-gray-100">
              Click anywhere on the map to drop a pin. The address fields will auto-fill automatically.
            </div>
            {mapLoading && (
              <div className="flex items-center justify-center h-64">
                <Loader2 size={28} className="animate-spin text-violet-500" />
              </div>
            )}
            <div ref={mapRef} className="w-full h-72" />
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-100">
              {value && (
                <span className="flex-1 text-xs text-slate-500 self-center truncate">{value}</span>
              )}
              <button
                onClick={() => setMapOpen(false)}
                className="glass-btn-solid px-4 py-2 text-sm"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
