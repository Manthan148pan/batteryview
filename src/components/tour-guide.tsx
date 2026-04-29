
'use client';

import React from 'react';
import Joyride, { Step, CallBackProps } from 'react-joyride';

interface TourGuideProps {
    run: boolean;
    setRun: (run: boolean) => void;
}

const TourGuide: React.FC<TourGuideProps> = ({ run, setRun }) => {
    const steps: Step[] = [
        {
            target: '#gateway-selector',
            content: 'Select your active gateway here. Choose "All Gateways" to view devices from all your registered gateways at once.',
            placement: 'bottom',
            title: 'Gateway Selector'
        },
        {
            target: '#scan-button',
            content: 'Click this to manually search for available BMS devices through the selected gateway.',
            placement: 'bottom',
            title: 'Scan for Devices'
        },
        {
            target: '#connect-all-button',
            content: 'This connects to all available devices one by one to log their current data to history.',
            placement: 'bottom',
            title: 'Connect to All'
        },
        {
            target: '#auto-button',
            content: 'Toggle this to enable automatic scanning and data logging at set intervals (configurable in Settings).',
            placement: 'bottom',
            title: 'Auto Mode'
        },
        {
            target: '#registered-count-badge',
            content: 'This shows the total number of BMS devices you have registered to your account.',
            placement: 'bottom',
            title: 'Registered Devices'
        },
        {
            target: '#bms-card-list',
            content: 'Available BMS devices will appear here. You can view their live status and connect to them individually.',
            placement: 'top',
            title: 'BMS Device Cards'
        },
        {
            target: '#details-button',
            content: 'View detailed real-time data for this battery, including all cell voltages and temperatures.',
            placement: 'top',
            title: 'View Details'
        },
        {
            target: '#connect-button',
            content: 'Connect to this single battery to fetch its latest data and save a snapshot to its history.',
            placement: 'top',
            title: 'Connect to Device'
        },
        {
            target: '#add-gateway-button',
            content: 'Use this to link a new gateway device to your account, allowing it to discover BMS devices.',
            placement: 'left',
            title: 'Add a Gateway'
        },
        {
            target: '#register-bms-button',
            content: 'Manually register your BMS devices here by their MAC address so the system can identify them.',
            placement: 'left',
            title: 'Register a BMS'
        }
    ];

    const handleJoyrideCallback = (data: CallBackProps) => {
        const { status } = data;
        const finishedStatuses: string[] = ['finished', 'skipped'];

        if (finishedStatuses.includes(status)) {
            setRun(false);
        }
    };
    
    return (
        <Joyride
            steps={steps}
            run={run}
            callback={handleJoyrideCallback}
            continuous
            showProgress
            showSkipButton
            styles={{
                options: {
                    arrowColor: '#fff',
                    backgroundColor: '#fff',
                    primaryColor: 'hsl(var(--primary))',
                    textColor: '#333',
                    zIndex: 1000,
                },
                tooltip: {
                    borderRadius: 'var(--radius)',
                },
                buttonNext: {
                     borderRadius: 'var(--radius)',
                },
                buttonBack: {
                     borderRadius: 'var(--radius)',
                }
            }}
        />
    );
};

export default TourGuide;
