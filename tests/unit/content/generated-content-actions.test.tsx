import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GeneratedContent } from '@/components/content/generated-content';

const content = {
  primary: 'Hello from the café',
  variations: ['Alt one', 'Alt two', 'Alt three'],
  metadata: {
    platform: 'instagram',
    hookType: 'question',
    length: 22,
    estimatedEngagement: 8,
    hashtags: ['#local'],
  },
};

describe('GeneratedContent actions', () => {
  it('tells a stranger what to do when there is no draft', () => {
    render(
      <GeneratedContent
        content={null}
        selectedVariation={0}
        onVariationChange={jest.fn()}
        editMode={false}
        onEditModeToggle={jest.fn()}
        editedContent=""
        onEditedContentChange={jest.fn()}
        onRefresh={jest.fn()}
        onCopy={jest.fn()}
        onSave={jest.fn()}
        onSchedule={jest.fn()}
        onPostNow={jest.fn()}
        onDiscard={jest.fn()}
      />
    );
    expect(screen.getByText('No draft yet')).toBeInTheDocument();
    expect(
      screen.getByText(/words you would actually post/i)
    ).toBeInTheDocument();
  });

  it('offers Save draft, Schedule, Post now, and Discard', async () => {
    const user = userEvent.setup();
    const onSave = jest.fn();
    const onSchedule = jest.fn();
    const onPostNow = jest.fn();
    const onDiscard = jest.fn();

    render(
      <GeneratedContent
        content={content}
        selectedVariation={0}
        onVariationChange={jest.fn()}
        editMode={false}
        onEditModeToggle={jest.fn()}
        editedContent=""
        onEditedContentChange={jest.fn()}
        onRefresh={jest.fn()}
        onCopy={jest.fn()}
        onSave={onSave}
        onSchedule={onSchedule}
        onPostNow={onPostNow}
        onDiscard={onDiscard}
      />
    );

    expect(
      screen.getByRole('button', { name: /save draft/i })
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^schedule$/i }));
    await user.click(screen.getByRole('button', { name: /post now/i }));
    await user.click(screen.getByRole('button', { name: /discard/i }));

    expect(onSchedule).toHaveBeenCalledTimes(1);
    expect(onPostNow).toHaveBeenCalledTimes(1);
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });
});
