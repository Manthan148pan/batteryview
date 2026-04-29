
'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Calendar } from '@/components/ui/calendar';
import {
    ArrowLeft,
    History,
    BarChart3,
    Calendar as CalendarIcon,
    Download,
    Battery,
    Thermometer,
    Info,
    Clock,
    FileText,
    FileSpreadsheet,
    ArrowRight,
    ArrowDown,
    DownloadCloud,
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { db, ref, get, query, orderByChild, equalTo } from '@/lib/firebase';
import { decodeBMSHex } from '@/lib/bms-decoder';
import type { DecodedBMSData } from '@/types/bms';
import CellVoltageChart from '@/components/cell-voltage-chart';
import TemperatureChart from '@/components/temperature-chart';
import { Separator } from '@/components/ui/separator';
import UnifiedDataTrendChart from '@/components/unified-data-trend-chart';
import jsPDF from 'jspdf';
import 'jspdf-autotable';


interface RegisteredBMS {
    id: string;
    deviceNickname: string;
    deviceName: string;
    locations?: string[];
    currentLocation?: string; // Add current location
}

interface HistoryDataPoint {
    time: string;
    timestamp: number;
    hex_data: string;
    gateway_location?: string;
    decodedData: DecodedBMSData; // Ensure decodedData is not null
}

interface ScanHistoryPoint {
    status: 'IN' | 'OUT';
    timestamp: number;
    scannedBy: string;
}

const SummaryItem = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex justify-between items-center text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}</span>
    </div>
);


function HistoryPageContent() {
    const { user, userProfile } = useAuth();
    const searchParams = useSearchParams();
    const deviceIdFromQuery = searchParams.get('deviceId');

    const [date, setDate] = useState<Date | undefined>();
    const [registeredDevices, setRegisteredDevices] = useState<RegisteredBMS[]>([]);
    const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
    const [availableTimestamps, setAvailableTimestamps] = useState<HistoryDataPoint[]>([]);
    const [selectedTimestamp, setSelectedTimestamp] = useState<string | null>(null);
    const [selectedDataDetail, setSelectedDataDetail] = useState<DecodedBMSData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isTimestampsLoading, setIsTimestampsLoading] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [scanHistory, setScanHistory] = useState<ScanHistoryPoint[]>([]);

    const [allLocations, setAllLocations] = useState<string[]>([]);
    const [selectedLocation, setSelectedLocation] = useState<string | null>(null);

    const [timeRange, setTimeRange] = useState<string>('day'); // 'day', 'week', 'month'
    const chartContainerRef = useRef<HTMLDivElement>(null);

    const userPathUid = userProfile?.role === 'sub_user' ? userProfile.main_user_uid : user?.uid;


    useEffect(() => {
        // Initialize date on client side only to avoid hydration mismatch
        setDate(new Date());
    }, []);

    // Fetch all devices and their locations initially
    useEffect(() => {
        const fetchRegisteredDevicesAndLocations = async () => {
            if (!userPathUid || !db) return;
            setIsLoading(true);
            try {
                const bmsDevicesRef = ref(db, `users/${userPathUid}/bms_devices`);
                const linkedDevicesRef = ref(db, `users/${userPathUid}/linked_devices`);

                const [bmsSnapshot, linkedSnapshot] = await Promise.all([get(bmsDevicesRef), get(linkedDevicesRef)]);

                const linkedDevicesData = linkedSnapshot.exists() ? linkedSnapshot.val() : {};

                if (bmsSnapshot.exists()) {
                    const data = bmsSnapshot.val();
                    const uniqueLocations = new Set<string>();

                    const devices: RegisteredBMS[] = await Promise.all(
                        Object.keys(data).map(async (macId) => {
                            const historyRef = ref(db, `users/${userPathUid}/bms_devices/${macId}/history`);
                            const historySnapshot = await get(historyRef);
                            const deviceLocations = new Set<string>();
                            if (historySnapshot.exists()) {
                                historySnapshot.forEach(dateSnapshot => {
                                    dateSnapshot.forEach(tsSnapshot => {
                                        const location = tsSnapshot.child('gateway_location').val();
                                        if (location && location !== 'N/A' && location !== 'Not set') {
                                            deviceLocations.add(location);
                                            uniqueLocations.add(location);
                                        }
                                    })
                                })
                            }

                            // Get current location from linked_devices
                            // This part assumes a BMS device is linked via a single gateway. 
                            // A more complex setup might need a different way to associate BMS to gateway location.
                            const gatewayId = Object.keys(linkedDevicesData).find(gid => linkedDevicesData[gid].bms_devices?.[macId]);
                            const currentLocation = gatewayId ? linkedDevicesData[gatewayId].location : undefined;
                            if (currentLocation && currentLocation !== 'N/A' && currentLocation !== 'Not set') {
                                uniqueLocations.add(currentLocation);
                            }

                            return {
                                id: macId,
                                deviceNickname: data[macId].deviceNickname || `BMS-${macId.substring(macId.length - 5)}`,
                                deviceName: data[macId].deviceName,
                                locations: Array.from(deviceLocations),
                                currentLocation: currentLocation
                            };
                        })
                    );
                } else {
                    setRegisteredDevices([]);
                    setAllLocations([]);
                }
            } catch (error) {
                console.error("Failed to fetch registered devices:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchRegisteredDevicesAndLocations();
    }, [userPathUid, db]); // Stable dependency

    const filteredDevices = useMemo(() => {
        if (!selectedLocation) return registeredDevices;
        return registeredDevices.filter(device =>
            device.locations?.includes(selectedLocation) || device.currentLocation === selectedLocation
        );
    }, [registeredDevices, selectedLocation]);

    // Consolidated device selection logic
    useEffect(() => {
        if (!selectedDevice && registeredDevices.length > 0) {
            if (deviceIdFromQuery && registeredDevices.some(d => d.id === deviceIdFromQuery)) {
                setSelectedDevice(deviceIdFromQuery);
            } else {
                setSelectedDevice(registeredDevices[0].id);
            }
        }
    }, [registeredDevices, deviceIdFromQuery, selectedDevice]);

    // Handle location-based device filtering/selection
    useEffect(() => {
        if (selectedLocation && filteredDevices.length > 0) {
            if (!filteredDevices.some(d => d.id === selectedDevice)) {
                setSelectedDevice(filteredDevices[0].id);
            }
        }
    }, [selectedLocation, filteredDevices, selectedDevice]);


    useEffect(() => {
        const fetchHistoryData = async () => {
            if (!userPathUid || !selectedDevice || !db || !date) {
                setAvailableTimestamps([]);
                setScanHistory([]);
                return;
            }

            // Only clear detail when device or date actually changes to prevent extra renders
            setIsTimestampsLoading(true);
            setSelectedTimestamp(null);
            setSelectedDataDetail(null);

            const currentDevice = registeredDevices.find(d => d.id === selectedDevice);

            const now = new Date();
            let startDate: Date;
            const endDate = timeRange === 'day' ? endOfDay(date) : now;

            switch (timeRange) {
                case 'week':
                    startDate = startOfDay(subDays(now, 6));
                    break;
                case 'month':
                    startDate = startOfDay(subDays(now, 29));
                    break;
                case 'day':
                default:
                    startDate = startOfDay(date);
                    break;
            }

            const dateKeysToFetch = new Set<string>();
            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                dateKeysToFetch.add(format(d, 'yyyy-MM-dd'));
                // Add previous day to handle timezone differences
                dateKeysToFetch.add(format(subDays(d, 1), 'yyyy-MM-dd'));
            }

            const allPoints: HistoryDataPoint[] = [];

            try {
                const historyPromises = Array.from(dateKeysToFetch).map(dateKey => {
                    const historyRef = ref(db, `users/${userPathUid}/bms_devices/${selectedDevice}/history/${dateKey}`);
                    return get(historyRef);
                });
                const snapshots = await Promise.all(historyPromises);

                snapshots.forEach(snapshot => {
                    if (snapshot.exists()) {
                        const dataByTimestamp = snapshot.val();
                        Object.entries(dataByTimestamp).forEach(([timestampStr, entry]: [string, any]) => {
                            const timestamp = Number(timestampStr);
                            const decodedData = entry.hex_data ? decodeBMSHex(entry.hex_data) : null;

                            // Ensure the data is valid and decodable before adding it
                            if (!isNaN(timestamp) && decodedData) {
                                allPoints.push({
                                    timestamp: timestamp,
                                    time: format(new Date(timestamp), 'MMM dd, HH:mm:ss'),
                                    hex_data: entry.hex_data,
                                    gateway_location: entry.gateway_location,
                                    decodedData: decodedData,
                                });
                            }
                        });
                    }
                });

                const uniquePoints = Array.from(new Map(allPoints.map(p => [p.timestamp, p])).values());

                const filteredPoints = uniquePoints.filter(p => {
                    const pointDate = new Date(p.timestamp);
                    const locationMatches = !selectedLocation || p.gateway_location === selectedLocation || currentDevice?.currentLocation === selectedLocation;
                    return pointDate >= startDate && pointDate <= endDate && locationMatches;
                });

                const sortedPoints = filteredPoints.sort((a, b) => a.timestamp - b.timestamp);
                setAvailableTimestamps(sortedPoints);

                const scanHistoryRef = ref(db, `users/${userPathUid}/bms_scan_history/${selectedDevice}`);
                const scanQuery = query(scanHistoryRef, orderByChild('timestamp'));
                const scanSnapshot = await get(scanQuery);
                if (scanSnapshot.exists()) {
                    const scanData: ScanHistoryPoint[] = [];
                    scanSnapshot.forEach(child => {
                        scanData.push(child.val());
                    });
                    setScanHistory(scanData.sort((a, b) => b.timestamp - a.timestamp));
                } else {
                    setScanHistory([]);
                }

            } catch (error) {
                console.error("Failed to fetch device history:", error);
            } finally {
                setIsTimestampsLoading(false);
            }
        };

        if (date) {
            fetchHistoryData();
        }
    }, [userPathUid, selectedDevice, date, timeRange, selectedLocation]);


    useEffect(() => {
        if (!selectedTimestamp || availableTimestamps.length === 0) {
            setSelectedDataDetail(null);
            return;
        }

        const point = availableTimestamps.find(p => String(p.timestamp) === selectedTimestamp);
        if (point && point.decodedData) {
            setSelectedDataDetail(point.decodedData);
        } else {
            setSelectedDataDetail(null);
        }

    }, [selectedTimestamp, availableTimestamps]);


    const getHistoryDataForDownload = async (deviceId: string, days: number) => {
        if (!userPathUid || !db) return [];

        const currentDevice = registeredDevices.find(d => d.id === deviceId);

        const endDate = new Date();
        const startDate = subDays(endDate, days - 1);

        const dateKeysToFetch = new Set<string>();
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            dateKeysToFetch.add(format(d, 'yyyy-MM-dd'));
            dateKeysToFetch.add(format(subDays(d, 1), 'yyyy-MM-dd'));
        }

        const historyPromises = Array.from(dateKeysToFetch).map(dateKey => {
            const historyRef = ref(db, `users/${userPathUid}/bms_devices/${deviceId}/history/${dateKey}`);
            return get(historyRef);
        });

        const snapshots = await Promise.all(historyPromises);
        let allData: (DecodedBMSData & { timestamp: number, gateway_location?: string })[] = [];

        snapshots.forEach(snapshot => {
            if (snapshot.exists()) {
                const dataByTimestamp = snapshot.val();
                Object.entries(dataByTimestamp).forEach(([timestampStr, entry]: [string, any]) => {
                    const timestamp = Number(timestampStr);
                    if (!isNaN(timestamp)) {
                        const historyLocation = entry.gateway_location;
                        const locationToUse = (historyLocation && historyLocation !== 'Not set' && historyLocation !== 'N/A') ? historyLocation : currentDevice?.currentLocation;
                        const locationMatches = !selectedLocation || locationToUse === selectedLocation;

                        if (entry.hex_data && locationMatches) {
                            const decoded = decodeBMSHex(entry.hex_data);
                            if (decoded) {
                                allData.push({ ...decoded, timestamp, gateway_location: locationToUse });
                            }
                        }
                    }
                });
            }
        });

        const uniqueData = Array.from(new Map(allData.map(d => [d.timestamp, d])).values());
        const localStartDate = startOfDay(startDate);
        const localEndDate = endOfDay(endDate);

        return uniqueData
            .filter(d => new Date(d.timestamp) >= localStartDate && new Date(d.timestamp) <= localEndDate)
            .sort((a, b) => a.timestamp - b.timestamp);
    };

    const handleDownloadCSV = async (days: number) => {
        if (!selectedDevice) {
            alert('Please select a device first.');
            return;
        }
        setIsDownloading(true);
        const allData = await getHistoryDataForDownload(selectedDevice, days);

        if (allData.length === 0) {
            alert('No data found for the selected period.');
            setIsDownloading(false);
            return;
        }

        const headers = [
            'Timestamp', 'GatewayLocation', 'TotalVoltage', 'Current', 'SOC', 'Power', 'Cycles', 'ChargingStatus',
            ...allData[0].cellVoltages.map((_, i) => `Cell${i + 1}_Voltage`),
            ...allData[0].temps.map((_, i) => `Temp${i + 1}`),
            'MosT1', 'MosT2'
        ];

        const dataRows = allData.map(data => [
            format(new Date(data.timestamp), 'yyyy-MM-dd HH:mm:ss'),
            data.gateway_location || 'N/A',
            data.totalVoltage, data.current, data.soc, data.power, data.cycles,
            data.chgMos ? 'ON' : 'OFF',
            ...data.cellVoltages,
            ...data.temps,
            data.mosT1, data.mosT2
        ].join(','));

        const csvContent = [headers.join(','), ...dataRows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-t8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        const filename = `BMS_History_${selectedDevice?.replace(/[^a-zA-Z0-9]/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setIsDownloading(false);
    };

    const handleDownloadAllCSV = async (days: number) => {
        setIsDownloading(true);
        let allBatteriesData: any[] = [];

        for (const device of registeredDevices) {
            const deviceData = await getHistoryDataForDownload(device.id, days);
            const dataWithNickname = deviceData.map(d => ({ ...d, deviceNickname: device.deviceNickname }));
            allBatteriesData = [...allBatteriesData, ...dataWithNickname];
        }

        if (allBatteriesData.length === 0) {
            alert('No data found for any battery in the selected period.');
            setIsDownloading(false);
            return;
        }

        allBatteriesData.sort((a, b) => a.timestamp - b.timestamp);

        const maxCellCount = Math.max(...allBatteriesData.map(d => d.cellVoltages.length));
        const maxTempCount = Math.max(...allBatteriesData.map(d => d.temps.length));

        const headers = [
            'DeviceNickname', 'Timestamp', 'GatewayLocation', 'TotalVoltage', 'Current', 'SOC', 'Power', 'Cycles', 'ChargingStatus',
            ...Array.from({ length: maxCellCount }, (_, i) => `Cell${i + 1}_Voltage`),
            ...Array.from({ length: maxTempCount }, (_, i) => `Temp${i + 1}`),
            'MosT1', 'MosT2'
        ];

        const dataRows = allBatteriesData.map(data => {
            const row = [
                data.deviceNickname,
                format(new Date(data.timestamp), 'yyyy-MM-dd HH:mm:ss'),
                data.gateway_location || 'N/A',
                data.totalVoltage, data.current, data.soc, data.power, data.cycles,
                data.chgMos ? 'ON' : 'OFF',
            ];

            const cellVoltages = [...data.cellVoltages, ...Array(maxCellCount - data.cellVoltages.length).fill('')];
            const temps = [...data.temps, ...Array(maxTempCount - data.temps.length).fill('')];

            return [...row, ...cellVoltages, ...temps, data.mosT1, data.mosT2].join(',');
        });

        const csvContent = [headers.join(','), ...dataRows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-t8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        const filename = `BMS_History_All_Batteries_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setIsDownloading(false);
    };

    const handleDownloadPDF = async (days: number) => {
        if (!selectedDevice) {
            alert('Please select a device first.');
            return;
        }
        setIsDownloading(true);
        const allData = await getHistoryDataForDownload(selectedDevice, days);
        const device = registeredDevices.find(d => d.id === selectedDevice);

        if (allData.length === 0 || !device) {
            alert('No data found for the selected period.');
            setIsDownloading(false);
            return;
        }

        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text(`Battery Performance Report: ${device.deviceNickname}`, 14, 22);
        doc.setFontSize(11);
        doc.setTextColor(100);
        const dateRange = `${format(subDays(new Date(), days - 1), 'LLL dd, yyyy')} - ${format(new Date(), 'LLL dd, yyyy')}`;
        doc.text(`Date Range: ${dateRange}`, 14, 28);

        const summary = allData.reduce((acc, data) => {
            acc.maxSoc = Math.max(acc.maxSoc, data.soc);
            acc.minSoc = Math.min(acc.minSoc, data.soc);
            acc.maxVoltage = Math.max(acc.maxVoltage, data.totalVoltage);
            acc.minVoltage = Math.min(acc.minVoltage, data.totalVoltage);
            const allTemps = [...data.temps, data.mosT1, data.mosT2];
            acc.maxTemp = Math.max(acc.maxTemp, ...allTemps);
            acc.minTemp = Math.min(acc.minTemp, ...allTemps);
            acc.maxCellVoltage = Math.max(acc.maxCellVoltage, data.maxCell);
            acc.minCellVoltage = Math.min(acc.minCellVoltage, data.minCell);
            return acc;
        }, {
            maxSoc: -Infinity, minSoc: Infinity, maxVoltage: -Infinity, minVoltage: Infinity,
            maxTemp: -Infinity, minTemp: Infinity, maxCellVoltage: -Infinity, minCellVoltage: -Infinity,
        });

        const summaryBody = [
            ['Max State of Charge (SOC)', `${summary.maxSoc.toFixed(2)}%`],
            ['Min State of Charge (SOC)', `${summary.minSoc.toFixed(2)}%`],
            ['Max Total Voltage', `${summary.maxVoltage.toFixed(2)} V`],
            ['Min Total Voltage', `${summary.minVoltage.toFixed(2)} V`],
            ['Max Temperature', `${summary.maxTemp.toFixed(2)}°C`],
            ['Min Temperature', `${summary.minTemp.toFixed(2)}°C`],
            ['Max Cell Voltage', `${summary.maxCellVoltage.toFixed(3)} V`],
            ['Min Cell Voltage', `${summary.minCellVoltage.toFixed(3)} V`],
        ];

        (doc as any).autoTable({
            startY: 40,
            head: [['Metric', 'Value']],
            body: summaryBody,
            theme: 'striped',
            headStyles: { fillColor: [22, 163, 74] }
        });

        doc.addPage();
        doc.setFontSize(16);
        doc.text('Data Trends Chart', 14, 22);

        if (chartContainerRef.current) {
            const { default: html2canvas } = await import('html2canvas');
            const canvas = await html2canvas(chartContainerRef.current, { scale: 2, backgroundColor: null });
            const imgData = canvas.toDataURL('image/png');
            const imgProps = doc.getImageProperties(imgData);
            const pdfWidth = doc.internal.pageSize.getWidth() - 28;
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            doc.addImage(imgData, 'PNG', 14, 30, pdfWidth, pdfHeight);
        }

        doc.addPage();
        doc.setFontSize(16);
        doc.text('Detailed Data Log', 14, 22);
        const tableData = allData.map(d => [
            format(new Date(d.timestamp), 'dd HH:mm'),
            d.totalVoltage.toFixed(2),
            d.current.toFixed(1),
            d.soc.toFixed(1),
            d.maxCell.toFixed(3),
            d.minCell.toFixed(3),
            Math.max(...d.temps, d.mosT1, d.mosT2).toFixed(1)
        ]);

        (doc as any).autoTable({
            startY: 30,
            head: [['Time', 'Voltage', 'Current', 'SOC', 'Max Cell', 'Min Cell', 'Max Temp']],
            body: tableData,
            theme: 'grid',
            didParseCell: (data: any) => {
                const isMinMaxRow = (colIndex: number, value: any) => {
                    if (colIndex === 4 && value == summary.maxCellVoltage.toFixed(3)) return true;
                    if (colIndex === 5 && value == summary.minCellVoltage.toFixed(3)) return true;
                    if (colIndex === 6 && value == summary.maxTemp.toFixed(1)) return true;
                    return false;
                }
                if (isMinMaxRow(data.column.index, data.cell.raw)) {
                    data.cell.styles.fillColor = '#fef9c3';
                    data.cell.styles.textColor = '#713f12';
                    data.cell.styles.fontStyle = 'bold';
                }
            },
        });

        doc.save(`BMS_Report_${device.deviceNickname.replace(/ /g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
        setIsDownloading(false);
    };



    return (
        <div className="min-h-screen bg-background">
            <header className="bg-card shadow-sm">
                <div className="container mx-auto flex flex-col px-4 sm:px-6 lg:px-8 py-4 gap-4">
                    <div className="flex items-center justify-between flex-wrap">
                        <div className="flex items-center gap-4">
                            <Button variant="outline" size="icon" asChild>
                                <Link href="/">
                                    <ArrowLeft className="h-4 w-4" />
                                </Link>
                            </Button>
                            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
                                Historical Analysis
                            </h1>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" disabled>
                                <History className="mr-2 h-4 w-4" />
                                History
                            </Button>
                            <Button variant="ghost" asChild>
                                <Link href="/compare">
                                    <BarChart3 className="mr-2 h-4 w-4" />
                                    Compare
                                </Link>
                            </Button>
                        </div>
                    </div>
                    <div className="flex flex-col sm:grid sm:grid-cols-2 lg:grid-cols-6 items-stretch sm:items-center gap-3">
                        <Select value={timeRange} onValueChange={(val) => { setTimeRange(val); setSelectedTimestamp(null); if (val !== 'day') setDate(new Date()) }}>
                            <SelectTrigger className="w-full h-11 sm:h-9">
                                <SelectValue placeholder="Time Range" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="day">Last 24h</SelectItem>
                                <SelectItem value="week">Last 7d</SelectItem>
                                <SelectItem value="month">Last 30d</SelectItem>
                            </SelectContent>
                        </Select>

                        {timeRange === 'day' && (
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        id="date"
                                        variant={'outline'}
                                        className={cn('w-full justify-start text-left font-normal h-11 sm:h-9', !date && 'text-muted-foreground')}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {date ? format(date, 'LLL dd, y') : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="end">
                                    <Calendar
                                        mode="single"
                                        selected={date}
                                        onSelect={setDate}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        )}

                        <Select value={selectedLocation || 'all'} onValueChange={(val) => setSelectedLocation(val === 'all' ? null : val)}>
                            <SelectTrigger className="w-full h-11 sm:h-9">
                                <SelectValue placeholder="Filter by Location" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Locations</SelectItem>
                                {allLocations.map(loc => (
                                    <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={selectedDevice || ''} onValueChange={(val) => { setSelectedDevice(val); setSelectedTimestamp(null); }} disabled={isLoading || filteredDevices.length === 0}>
                            <SelectTrigger className="w-full h-11 sm:h-9">
                                <SelectValue placeholder="Select Battery" />
                            </SelectTrigger>
                            <SelectContent>
                                {isLoading ? (
                                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                                ) : filteredDevices.length > 0 ? (
                                    filteredDevices.map(dev => (
                                        <SelectItem key={dev.id} value={dev.id}>{dev.deviceNickname}</SelectItem>
                                    ))
                                ) : (
                                    <SelectItem value="no-devices" disabled>No devices found</SelectItem>
                                )}
                            </SelectContent>
                        </Select>

                        <Select value={selectedTimestamp || ''} onValueChange={setSelectedTimestamp} disabled={isTimestampsLoading || availableTimestamps.length === 0}>
                            <SelectTrigger className="w-full h-11 sm:h-9">
                                <SelectValue placeholder="View Specific Time" />
                            </SelectTrigger>
                            <SelectContent>
                                {isTimestampsLoading ? (
                                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                                ) : availableTimestamps.length > 0 ? (
                                    availableTimestamps.map(ts => (
                                        <SelectItem key={ts.timestamp} value={String(ts.timestamp)}>{format(new Date(ts.timestamp), 'HH:mm:ss')}</SelectItem>
                                    ))
                                ) : (
                                    <SelectItem value="no-times" disabled>No data points</SelectItem>
                                )}
                            </SelectContent>
                        </Select>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" disabled={isDownloading} className="w-full h-11 sm:h-9 border-primary/20 bg-primary/5 text-primary">
                                    <Download className="mr-2 h-4 w-4" />
                                    {isDownloading ? 'Downloading...' : 'Download Report'}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[calc(100vw-2rem)] sm:w-56">
                                <DropdownMenuItem onClick={() => handleDownloadCSV(timeRange === 'day' ? 1 : timeRange === 'week' ? 7 : 30)}>
                                    <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" /> Download Selected (CSV)
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDownloadPDF(timeRange === 'day' ? 1 : timeRange === 'week' ? 7 : 30)}>
                                    <FileText className="mr-2 h-4 w-4 text-red-600" /> Download Selected (PDF)
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleDownloadAllCSV(timeRange === 'day' ? 1 : timeRange === 'week' ? 7 : 30)}>
                                    <DownloadCloud className="mr-2 h-4 w-4 text-blue-600" /> Download All Batteries (CSV)
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </header>
            <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Battery Analysis</CardTitle>
                            <CardDescription>
                                Reviewing historical data for the selected battery. All times are in your local timezone.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            {isTimestampsLoading ? (
                                <div className="flex justify-center items-center h-[300px]">
                                    <p>Loading data...</p>
                                </div>
                            ) : availableTimestamps.length > 0 ? (
                                selectedDataDetail ? (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                            <div>
                                                <h3 className="text-lg font-semibold flex items-center mb-4"><Battery className="mr-2 h-5 w-5 text-primary" />Cell Voltages at {format(new Date(Number(selectedTimestamp)), 'HH:mm:ss')}</h3>
                                                <CellVoltageChart data={selectedDataDetail.cellVoltages} />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-semibold flex items-center mb-4"><Thermometer className="mr-2 h-5 w-5 text-primary" />Temperatures at {format(new Date(Number(selectedTimestamp)), 'HH:mm:ss')}</h3>
                                                <TemperatureChart temps={selectedDataDetail.temps} mosT1={selectedDataDetail.mosT2} />
                                            </div>
                                        </div>
                                        <Separator />
                                        <div>
                                            <h3 className="text-lg font-semibold flex items-center mb-4"><Info className="mr-2 h-5 w-5 text-primary" />Battery Summary at {format(new Date(Number(selectedTimestamp)), 'HH:mm:ss')}</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 p-4 bg-muted/50 rounded-lg">
                                                <SummaryItem label="Nominal Capacity" value={`${(selectedDataDetail.capacity / 1000).toFixed(1)} Ah`} />
                                                <SummaryItem label="Remaining Capacity" value={`${selectedDataDetail.remCap} Ah`} />
                                                <SummaryItem label="Total Voltage" value={`${selectedDataDetail.totalVoltage} V`} />
                                                <SummaryItem label="Average Voltage" value={`${selectedDataDetail.avgVolt} V`} />
                                                <SummaryItem label="Current" value={`${selectedDataDetail.current} A`} />
                                                <SummaryItem label="Power" value={`${selectedDataDetail.power} kW`} />
                                                <SummaryItem label="State of Charge (SOC)" value={`${selectedDataDetail.soc}%`} />
                                                <SummaryItem label="Cycles" value={selectedDataDetail.cycles} />
                                                <SummaryItem label="Max Cell Voltage" value={`${selectedDataDetail.maxCell} V`} />
                                                <SummaryItem label="Min Cell Voltage" value={`${selectedDataDetail.minCell} V`} />
                                                <SummaryItem label="Avg Cell Voltage" value={`${selectedDataDetail.avgCellVolt} V`} />
                                                <SummaryItem label="Cell Count" value={selectedDataDetail.cellCount} />
                                                <SummaryItem label="Temp Sensors" value={selectedDataDetail.tempCount} />
                                                <SummaryItem label="MOS Temp 1 / 2" value={`${selectedDataDetail.mosT1}°C / ${selectedDataDetail.mosT2}°C`} />
                                                <SummaryItem label="Balancing" value={selectedDataDetail.balance ? 'ON' : 'OFF'} />
                                                <SummaryItem label="Charge MOS" value={selectedDataDetail.chgMos ? 'ON' : 'OFF'} />
                                                <SummaryItem label="Discharge MOS" value={selectedDataDetail.dischgMos ? 'ON' : 'OFF'} />
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div ref={chartContainerRef}>
                                        <div className="space-y-8">
                                            <div>
                                                <h3 className="text-lg font-semibold flex items-center mb-4"><Clock className="mr-2 h-5 w-5 text-primary" />Data Trends</h3>
                                                <UnifiedDataTrendChart data={availableTimestamps} />
                                            </div>
                                        </div>
                                    </div>
                                )
                            ) : (
                                <div className="text-center py-16 border-2 border-dashed rounded-lg">
                                    <h3 className="text-xl font-medium text-gray-900 dark:text-gray-100">
                                        No Historical Data Found
                                    </h3>
                                    <p className="mt-2 text-sm text-muted-foreground">
                                        There is no data for the selected device on the chosen date or range.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
                <div className="lg:col-span-1">
                    <Card>
                        <CardHeader>
                            <CardTitle>Scan History (In/Out)</CardTitle>
                            <CardDescription>
                                Log of when the battery was scanned in or out.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isTimestampsLoading ? (
                                <div className="flex justify-center items-center h-[100px]"><p>Loading scan history...</p></div>
                            ) : scanHistory.length > 0 ? (
                                <div className="space-y-4 max-h-96 overflow-y-auto">
                                    {scanHistory.map((item, index) => (
                                        <div key={index} className="flex items-center gap-4">
                                            <div className={`flex items-center justify-center h-8 w-8 rounded-full ${item.status === 'IN' ? 'bg-green-100' : 'bg-red-100'}`}>
                                                {item.status === 'IN' ? <ArrowRight className="h-5 w-5 text-green-600" /> : <ArrowLeft className="h-5 w-5 text-red-600" />}
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-semibold">{item.status === 'IN' ? 'Checked In' : 'Checked Out'}</p>
                                                <p className="text-xs text-muted-foreground">{format(new Date(item.timestamp), 'MMM dd, yyyy, hh:mm a')}</p>
                                            </div>
                                            <p className="text-xs text-muted-foreground">{item.scannedBy}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center">No scan history for this device.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}

export default function HistoryPage() {
    return (
        <React.Suspense fallback={<div>Loading...</div>}>
            <HistoryPageContent />
        </React.Suspense>
    )
}
