import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { therapistsApi } from '../api/services';
import { httpError, makeOwnProfile } from '../test/utils';
import AvatarUploader from './AvatarUploader';

vi.mock('../api/services', () => ({ therapistsApi: { uploadAvatar: vi.fn(), deleteAvatar: vi.fn() } }));

const png = () => new File(['png-bytes'], 'photo.png', { type: 'image/png' });

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});

function setup(imageUrl?: string) {
  const onChange = vi.fn();
  const { container } = render(<AvatarUploader name="דנה כהן" imageUrl={imageUrl} onChange={onChange} />);
  const input = container.querySelector('input[type=file]') as HTMLInputElement;
  return { onChange, input };
}

describe('AvatarUploader', () => {
  it('offers "upload" when there is no picture, and "replace" + "remove" when there is one', () => {
    const { unmount } = render(<AvatarUploader name="דנה" imageUrl={undefined} onChange={vi.fn()} />);
    expect(screen.getByText('העלאת תמונה')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'הסרת התמונה' })).not.toBeInTheDocument();
    unmount();

    render(<AvatarUploader name="דנה" imageUrl="/uploads/avatars/a.webp" onChange={vi.fn()} />);
    expect(screen.getByText('החלפת תמונה')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'הסרת התמונה' })).toBeInTheDocument();
  });

  it('only offers image types in the file picker', () => {
    const { input } = setup();
    expect(input).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');
  });

  it('uploads a valid image and hands the updated profile back', async () => {
    const updated = makeOwnProfile({ profileImageUrl: '/uploads/avatars/new.webp' });
    vi.mocked(therapistsApi.uploadAvatar).mockResolvedValue(updated);
    const { onChange, input } = setup();
    const file = png();
    await userEvent.upload(input, file);

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(updated));
    expect(therapistsApi.uploadAvatar).toHaveBeenCalledWith(file);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the chosen picture immediately while it uploads, then lets go of the temporary preview', async () => {
    let finish: (profile: ReturnType<typeof makeOwnProfile>) => void = () => undefined;
    vi.mocked(therapistsApi.uploadAvatar).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { input } = setup();
    await userEvent.upload(input, png());

    expect(await screen.findByText('מעלה...')).toBeInTheDocument();
    expect(screen.getByAltText('תמונת הפרופיל הנוכחית')).toHaveAttribute('src', 'blob:preview');
    expect(input).toBeDisabled();

    finish(makeOwnProfile());
    await waitFor(() => expect(screen.queryByText('מעלה...')).not.toBeInTheDocument());
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
  });

  it('rejects a file of the wrong type right away, without calling the server', async () => {
    // applyAccept: false = behave like a user who bypasses the picker's filter (e.g. drag and drop)
    const user = userEvent.setup({ applyAccept: false });
    const { input, onChange } = setup();
    await user.upload(input, new File(['hello'], 'notes.txt', { type: 'text/plain' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('JPG, PNG או WEBP בלבד');
    expect(therapistsApi.uploadAvatar).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('rejects a PDF (avatars must be images)', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { input } = setup();
    await user.upload(input, new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(therapistsApi.uploadAvatar).not.toHaveBeenCalled();
  });

  it('rejects a file larger than 5 MB right away', async () => {
    const { input } = setup();
    await userEvent.upload(input, new File([new ArrayBuffer(6 * 1024 * 1024)], 'huge.png', { type: 'image/png' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('גדול מדי');
    expect(therapistsApi.uploadAvatar).not.toHaveBeenCalled();
  });

  it('translates a server rejection into Hebrew and does not change the profile', async () => {
    vi.mocked(therapistsApi.uploadAvatar).mockRejectedValue(httpError(400, { code: 'IMAGE_INVALID', message: 'The image could not be processed' }));
    const { input, onChange } = setup();
    await userEvent.upload(input, png());
    expect(await screen.findByRole('alert')).toHaveTextContent('לא ניתן לעבד את התמונה');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('removes the picture after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const updated = makeOwnProfile({ profileImageUrl: undefined });
    vi.mocked(therapistsApi.deleteAvatar).mockResolvedValue(updated);
    const { onChange } = setup('/uploads/avatars/a.webp');
    await userEvent.click(screen.getByRole('button', { name: 'הסרת התמונה' }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(updated));
    expect(therapistsApi.deleteAvatar).toHaveBeenCalledTimes(1);
  });

  it('keeps the picture when the confirmation is declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { onChange } = setup('/uploads/avatars/a.webp');
    await userEvent.click(screen.getByRole('button', { name: 'הסרת התמונה' }));
    expect(therapistsApi.deleteAvatar).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });
});
