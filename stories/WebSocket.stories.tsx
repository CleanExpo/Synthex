import type { Meta, StoryObj } from '@storybook/react';
import { WebSocketProvider } from '@/components/WebSocketProvider';
import { WebSocketExample } from '@/components/examples/WebSocketExample';

const meta = {
  title: 'Features/WebSocket',
  component: WebSocketExample,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Real-time WebSocket integration for notifications and live updates.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <WebSocketProvider autoConnect={false} showConnectionStatus={true}>
        <div className="p-4">
          <Story />
        </div>
      </WebSocketProvider>
    ),
  ],
} satisfies Meta<typeof WebSocketExample>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WebSocketDemo: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Interactive WebSocket demo showing connection management, real-time notifications, and channel subscriptions.',
      },
    },
  },
};

export const ConnectionStatus: Story = {
  render: () => (
    <WebSocketProvider showConnectionStatus={true} autoConnect={true}>
      <div className="p-8 space-y-4">
        <h2 className="text-2xl font-bold">WebSocket Connection Status</h2>
        <p className="text-muted-foreground">
          This story demonstrates the connection status indicator in the top-right corner.
          The indicator shows the current WebSocket connection state and provides a reconnect button when disconnected.
        </p>
        <div className="bg-muted p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Status Indicators:</h3>
          <ul className="space-y-1 text-sm">
            <li><strong>Green dot:</strong> Connected</li>
            <li><strong>Yellow dot:</strong> Connecting</li>
            <li><strong>Red dot:</strong> Disconnected</li>
          </ul>
        </div>
      </div>
    </WebSocketProvider>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Shows the WebSocket connection status indicator component.',
      },
    },
  },
};