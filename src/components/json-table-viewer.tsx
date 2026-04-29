
'use client';

import * as React from 'react';
import { ChevronRight, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

interface JsonTableViewProps {
  data: any;
  level?: number;
  isRoot?: boolean;
}

const JsonValue = ({ value }: { value: any }) => {
  if (value === null || value === undefined) {
    return <span className="text-gray-500">null</span>;
  }

  if (typeof value === 'string') {
    if (value.length > 50) {
        return <span className="text-green-600 dark:text-green-400 break-all">"{value.substring(0, 50)}..."</span>;
    }
    return <span className="text-green-600 dark:text-green-400">"{value}"</span>;
  }
  if (typeof value === 'number') {
    return <span className="text-blue-600 dark:text-blue-400">{value}</span>;
  }
  if (typeof value === 'boolean') {
    return <span className="text-purple-600 dark:text-purple-400">{String(value)}</span>;
  }
  return <span>{String(value)}</span>;
};

const JsonTableRow = ({ nodeKey, value, level }: { nodeKey: string; value: any; level: number }) => {
  const [isExpanded, setIsExpanded] = React.useState(level < 2);
  const isObject = value !== null && typeof value === 'object';

  const handleToggle = () => {
    if (isObject) {
      setIsExpanded(!isExpanded);
    }
  };

  const keyStyle = { paddingLeft: `${level * 1.5 + 0.5}rem` };

  return (
    <>
      <TableRow onClick={handleToggle} className={cn(isObject && 'cursor-pointer')}>
        <TableCell
          className="font-medium"
          style={keyStyle}
        >
          <div className="flex items-center">
            {isObject && (
              <ChevronRight
                className={cn('h-4 w-4 mr-2 transition-transform', isExpanded && 'rotate-90')}
              />
            )}
            <span className={cn(!isObject && 'ml-6')}>
              {nodeKey}
            </span>
          </div>
        </TableCell>
        <TableCell>
          {isObject ? (
            <span className="text-muted-foreground">{Array.isArray(value) ? 'Array' : 'Object'}({Object.keys(value).length})</span>
          ) : (
            <JsonValue value={value} />
          )}
        </TableCell>
      </TableRow>
      {isObject && isExpanded && (
        <JsonTableView data={value} level={level + 1} />
      )}
    </>
  );
};

const UserTable = ({ userId, userData }: { userId: string, userData: any }) => {
    const userEmail = userData?.email || 'N/A';

    return (
        <Accordion type="single" collapsible className="w-full border rounded-lg mb-4">
            <AccordionItem value={userId}>
                <AccordionTrigger className="px-4 py-3 bg-card hover:no-underline">
                    <div className="flex items-center gap-3">
                        <User className="h-5 w-5 text-primary" />
                        <div className='text-left'>
                            <p className="font-semibold">{userEmail}</p>
                        </div>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="p-0">
                   <div className="overflow-x-auto">
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-1/3">Key</TableHead>
                                <TableHead>Value</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <JsonTableView data={userData} level={0} isRoot={false} />
                        </TableBody>
                     </Table>
                   </div>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    )
}

export const JsonTableView = ({ data, level = 0, isRoot = true }: JsonTableViewProps) => {

  if (isRoot && data && data.users) {
    const { users, ...restOfData } = data;
    return (
        <div>
            {Object.entries(users).map(([userId, userData]) => (
                <UserTable key={userId} userId={userId} userData={userData} />
            ))}
            {Object.keys(restOfData).length > 0 && (
                 <div className="mt-8">
                    <h3 className="text-lg font-semibold mb-4">Other Root Data</h3>
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-1/3">Key</TableHead>
                                    <TableHead>Value</TableHead>
                                </TableRow>
                            </TableHeader>
                             <TableBody>
                                <JsonTableView data={restOfData} level={0} isRoot={false} />
                            </TableBody>
                        </Table>
                    </div>
                 </div>
            )}
        </div>
    );
  }

  const entries = Object.entries(data);

  if (level === 0 && !isRoot) { // Render table for non-user root or nested objects
    return (
        <>
            {entries.map(([key, value]) => (
                <JsonTableRow key={key} nodeKey={key} value={value} level={level} />
            ))}
        </>
    );
  }
  
  // Render only rows for nested levels
  return (
    <>
      {entries.map(([key, value]) => (
        <JsonTableRow key={key} nodeKey={key} value={value} level={level} />
      ))}
    </>
  );
};

export default JsonTableView;
