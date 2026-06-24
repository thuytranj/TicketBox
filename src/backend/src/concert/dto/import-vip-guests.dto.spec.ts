import { validate } from 'class-validator';
import { VipGuestRowDto } from './import-vip-guests.dto';

describe('VipGuestRowDto', () => {
  it('should pass validation with valid VN phone number', async () => {
    const dto = new VipGuestRowDto();
    dto.fullName = 'John Doe';
    dto.email = 'john@example.com';
    dto.phone = '0912345678';
    dto.affiliateCompany = 'Google';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should pass validation with +84 phone format', async () => {
    const dto = new VipGuestRowDto();
    dto.fullName = 'John Doe';
    dto.email = 'john@example.com';
    dto.phone = '+84912345678';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail validation with invalid phone number format', async () => {
    const dto = new VipGuestRowDto();
    dto.fullName = 'John Doe';
    dto.email = 'john@example.com';
    dto.phone = '123456';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const phoneError = errors.find((e) => e.property === 'phone');
    expect(phoneError).toBeDefined();
    expect(phoneError?.constraints).toBeDefined();
    expect(Object.values(phoneError?.constraints ?? {})).toContain('Invalid phone number format');
  });

  it('should pass validation if phone is omitted (optional)', async () => {
    const dto = new VipGuestRowDto();
    dto.fullName = 'John Doe';
    dto.email = 'john@example.com';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });
});
