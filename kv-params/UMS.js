/*
** Author: Giancarlo Trevisan
** Date: 2025/03/21
** Description: Unit of measures
*/
const UMS = [
	{ "id": 9, "en": "Current", "it": "Corrente", "msu": "A" },
	{ "id": 30, "en": "Short circuit current", "it": "Corrente di corto circuito", "msu": "kA" },
	{ "id": 35, "en": "Phase", "it": "Fase", "msu": "ph" },
	{ "id": 24, "en": "Force", "it": "Forza", "msu": "N\/m", "isu": "lb\/f", "convert": x => 0.737562 * x },
	{ "id": 18, "en": "Frequency", "it": "Frequenza", "msu": "Hz" },
	{ "id": 3, "en": "Length", "it": "Lunghezza", "msu": "cm", "isu": "in", "convert": x => 0.39 * x },
	{ "id": 2, "en": "Length", "it": "Lunghezza", "msu": "m", "isu": "ft", "convert": x => 3.28 * x },
	{ "id": 28, "en": "Length", "it": "Lunghezza", "msu": "mm", "isu": "inch", "convert": x => 0.0393701 * x },
	{ "id": 20, "en": "Length", "it": "Lunghezza", "msu": "mm", "isu": "mils", "convert": x => 39.3701 * x },
	{ "id": 34, "en": "Number", "it": "Numero", "msu": "N°" },
	{ "id": 13, "en": "Percentage", "it": "Percentuale", "msu": "%" },
	{ "id": 1, "en": "Weight", "it": "Peso", "msu": "kg", "isu": "lb", "convert": x => 2.2 * x },
	{ "id": 15, "en": "Flow rate", "it": "Portata", "msu": "l\/min", "isu": "cfm", "convert": x => 0.035314 * x },
	{ "id": 7, "en": "Flow rate", "it": "Portata", "msu": "l\/min", "isu": "gpm", "convert": x => 0.264172 * x },
	{ "id": 23, "en": "Flow rate", "it": "Portata", "msu": "m³\/h", "isu": "cfm", "convert": x => 0.588578 * x },
	{ "id": 33, "en": "Flow rate", "it": "Portata", "msu": "m³\/min", "isu": "cfm", "convert": x => 35.315 * x },
	{ "id": 14, "en": "Power", "it": "Potenza", "msu": "Watt", "isu": "hp", "convert": x => 0.00134102 * x },
	{ "id": 29, "en": "Apparent power", "it": "Potenza apparente", "msu": "kVA", "isu": "HP", "convert": x => 0.7355 * x },
	{ "id": 5, "en": "Power", "it": "Potenza attiva", "msu": "kW", "isu": "hp", "convert": x => 1.34102 * x },
	{ "id": 4, "en": "Pressure", "it": "Pressione", "msu": "bar", "isu": "psi", "convert": x => 14.5038 * x },
	{ "id": 11, "en": "Power", "it": "Pressione sonora", "msu": "dB\/(A)" },
	{ "id": 6, "en": "Temperature", "it": "Temperatura", "msu": "°C", "isu": "°F", "convert": x => 5.0 * x / 9.0 + 32.0 },
	{ "id": 19, "en": "Time", "it": "Tempo", "msu": "min" },
	{ "id": 37, "en": "Time", "it": "Tempo", "msu": "ore" },
	{ "id": 21, "en": "Time", "it": "Tempo", "msu": "sec" },
	{ "id": 16, "en": "Voltage", "it": "Tensione", "msu": "V" },
	{ "id": 31, "en": "Voltage AC", "it": "Tensione AC", "msu": "VAC" },
	{ "id": 32, "en": "Voltage DC", "it": "Tensione DC", "msu": "VDC" },
	{ "id": 10, "en": "Speed of rotation", "it": "Velocità di rotazione", "msu": "rpm" },
	{ "id": 36, "en": "Vibrations", "it": "Vibrazioni", "msu": "mm\/sec", "isu": "IPS", "convert": x => 0.0393701 * x },
	{ "id": 17, "en": "Volume", "it": "Volume", "msu": "l", "isu": "gal", "convert": x => 0.264172 * x },
	{ "id": 12, "en": "Volume", "it": "Volume", "msu": "m³", "isu": "ft³", "convert": x => 35.3147 * x }
];
